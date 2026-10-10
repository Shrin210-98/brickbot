import { useEffect, useState, useSyncExternalStore } from 'react'
import { streamChatMessage, useChatTranscript, useCreateChatSession } from '@/api/chat'
import { ApiError, isNotFound } from '@/lib/api'
import type { ChatLine, ChatSession, ChatToolName, ListingSummary } from '@/types/api'

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
  listings?: ListingSummary[] // from `listings` events, for cards
  tool?: ChatToolName // the latest tool started, for a "Searching…" hint
  leadCreated?: boolean // a `lead_created` event arrived in this reply
  pending?: boolean // the reply is still streaming
  history?: boolean // restored from the transcript of an earlier page load
}

export type ChatStatus = 'idle' | 'streaming' | 'error'

export interface ChatState {
  messages: ChatMessage[]
  status: ChatStatus
  error: string | null
  restoring: boolean // a saved session's transcript is still loading
}

export interface UseChat extends ChatState {
  send: (text: string) => Promise<void>
  abort: () => void
  retry: () => Promise<void>
  reset: () => void
}

const VISITOR_KEY = 'brickbot.visitor_id'
const SESSION_KEY = 'brickbot.chat_session'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Used when localStorage is unavailable, so the id lasts for this page load.
let memoryVisitorId: string | null = null

// Returns this browser's visitor_id, creating and storing it on first use.
export function getVisitorId(): string {
  try {
    const stored = localStorage.getItem(VISITOR_KEY)
    if (stored && UUID_RE.test(stored)) return stored
  } catch {
    // Storage blocked or missing: fall through to the in-memory id.
  }
  memoryVisitorId ??= uuid()
  try {
    localStorage.setItem(VISITOR_KEY, memoryVisitorId)
  } catch {
    // Keep the in-memory id.
  }
  return memoryVisitorId
}

// Returns the session saved by an earlier page load, if any.
function readSavedSession(): string | null {
  try {
    const id = localStorage.getItem(SESSION_KEY)
    return id && UUID_RE.test(id) ? id : null
  } catch {
    return null
  }
}

// Saves the conversation's session id, or forgets it when id is null.
function saveSession(id: string | null) {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id)
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // Storage blocked: the conversation just won't survive a reload.
  }
}

// crypto.randomUUID exists only in secure contexts (not on plain-HTTP LAN addresses).
function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export interface ChatDeps {
  visitorId: string
  createSession: (visitorId: string) => Promise<ChatSession>
  stream?: typeof streamChatMessage
  // A session saved by an earlier page load. Its transcript is expected via restore.
  sessionId?: string | null
  // Called with each new session id, and with null when the session is dropped.
  onSession?: (id: string | null) => void
}

export interface Chat {
  getState: () => ChatState
  subscribe: (listener: () => void) => () => void
  send: (text: string) => Promise<void>
  // Aborts the reply in flight, keeping the conversation.
  abort: () => void
  // After an error, sends the last visitor message again.
  retry: () => Promise<void>
  // Aborts the reply in flight and starts a new conversation.
  reset: () => void
  // Puts the saved session's transcript above any newer turns.
  restore: (lines: ChatLine[]) => void
  // Gives up restoring; sessionGone also drops the saved session.
  dropRestore: (sessionGone: boolean) => void
}

const INITIAL: ChatState = { messages: [], status: 'idle', error: null, restoring: false }

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof TypeError) return "Couldn't reach the server. Check your connection and try again."
  return 'Something went wrong. Please try again.'
}

// createChat holds one visitor's conversation outside React, so the turn logic
// is testable without a DOM. useChat subscribes to it.
export function createChat({
  visitorId,
  createSession,
  stream = streamChatMessage,
  sessionId: saved = null,
  onSession = () => {},
}: ChatDeps): Chat {
  let state: ChatState = { ...INITIAL, restoring: saved !== null }
  let sessionId = saved
  let inflight: AbortController | null = null
  let nextId = 1
  const listeners = new Set<() => void>()

  const set = (next: Partial<ChatState>) => {
    state = { ...state, ...next }
    listeners.forEach((l) => l())
  }
  // Settles the reply: drops it when nothing arrived, else clears pending.
  const settle = (replyId: number) =>
    state.messages.flatMap((m) => {
      if (m.id !== replyId) return [m]
      return m.text || m.listings || m.leadCreated ? [{ ...m, pending: false }] : []
    })
  const patch = (replyId: number, fn: (m: ChatMessage) => ChatMessage) =>
    set({ messages: state.messages.map((m) => (m.id === replyId ? fn(m) : m)) })

  async function send(text: string) {
    const content = text.trim()
    if (content === '' || state.status === 'streaming') return
    const ctrl = new AbortController()
    inflight = ctrl
    const replyId = nextId + 1
    set({
      status: 'streaming',
      error: null,
      messages: [
        ...state.messages,
        { id: nextId, role: 'user', text: content },
        { id: replyId, role: 'assistant', text: '', pending: true },
      ],
    })
    nextId += 2
    const fail = (message: string) => set({ status: 'error', error: message, messages: settle(replyId) })

    let ended = false
    try {
      const id = sessionId ?? (await createSession(visitorId)).id
      if (ctrl.signal.aborted) return
      if (id !== sessionId) {
        sessionId = id
        onSession(id)
      }
      await stream(
        id,
        { visitor_id: visitorId, content },
        (e) => {
          if (ctrl.signal.aborted || ended) return
          switch (e.event) {
            case 'delta':
              patch(replyId, (m) => ({ ...m, text: m.text + e.data.text }))
              break
            case 'tool':
              patch(replyId, (m) => ({ ...m, tool: e.data.name }))
              break
            case 'listings':
              patch(replyId, (m) => ({ ...m, listings: [...(m.listings ?? []), ...e.data.items] }))
              break
            case 'lead_created':
              patch(replyId, (m) => ({ ...m, leadCreated: true }))
              break
            case 'done':
              ended = true
              set({ status: 'idle', messages: settle(replyId) })
              break
            case 'error':
              ended = true
              fail(e.data.message)
              break
          }
        },
        ctrl.signal,
      )
      if (!ended && !ctrl.signal.aborted) fail('The reply was cut off. Please try again.')
    } catch (err) {
      if (ctrl.signal.aborted) return
      // The session is gone (or not ours): the next message starts a new one.
      if (err instanceof ApiError && err.status === 404) {
        sessionId = null
        onSession(null)
      }
      fail(errorMessage(err))
    } finally {
      if (inflight === ctrl) inflight = null
    }
  }

  function abort() {
    if (!inflight) return
    const ctrl = inflight
    inflight = null
    ctrl.abort()
    const pending = state.messages.find((m) => m.pending)
    set({ status: 'idle', messages: pending ? settle(pending.id) : state.messages })
  }

  function retry() {
    const last = state.messages.at(-1)
    if (state.status !== 'error' || last?.role !== 'user') return Promise.resolve()
    // send appends the message again, so drop the failed copy first.
    set({ messages: state.messages.slice(0, -1) })
    return send(last.text)
  }

  function reset() {
    inflight?.abort()
    inflight = null
    sessionId = null
    onSession(null)
    set(INITIAL)
  }

  function restore(lines: ChatLine[]) {
    if (!state.restoring) return
    const history: ChatMessage[] = lines.map((l) => ({ id: nextId++, role: l.role, text: l.text, history: true }))
    set({ restoring: false, messages: [...history, ...state.messages] })
  }

  function dropRestore(sessionGone: boolean) {
    if (!state.restoring) return
    // A turn sent meanwhile already moved to a new session; keep that one.
    if (sessionGone && sessionId === saved) {
      sessionId = null
      onSession(null)
    }
    set({ restoring: false })
  }

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    send,
    abort,
    retry,
    reset,
    restore,
    dropRestore,
  }
}

// useChat runs the visitor chatbot: it creates a session on the first
// message, streams replies into messages, and saves the session so a reload
// restores the conversation from its transcript.
export function useChat(): UseChat {
  // mutateAsync is stable: it is bound to the mutation observer.
  const { mutateAsync: createSession } = useCreateChatSession()
  const [{ chat, visitorId, saved }] = useState(() => {
    const visitorId = getVisitorId()
    const saved = readSavedSession()
    return { visitorId, saved, chat: createChat({ visitorId, createSession, sessionId: saved, onSession: saveSession }) }
  })
  useEffect(() => chat.abort, [chat])
  const state = useSyncExternalStore(chat.subscribe, chat.getState)

  // Load the saved transcript once, never while a reply streams. A 404 means
  // the session is gone: drop it quietly and start fresh.
  const transcript = useChatTranscript(state.restoring && state.status !== 'streaming' ? saved : null, visitorId)
  useEffect(() => {
    if (transcript.data) chat.restore(transcript.data)
    else if (transcript.error) chat.dropRestore(isNotFound(transcript.error))
  }, [chat, transcript.data, transcript.error])

  return { ...state, send: chat.send, abort: chat.abort, retry: chat.retry, reset: chat.reset }
}
