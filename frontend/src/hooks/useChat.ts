import { useEffect, useState, useSyncExternalStore } from 'react'
import { streamChatMessage, useCreateChatSession } from '@/api/chat'
import { ApiError } from '@/lib/api'
import type { ChatSession, ChatToolName, ListingSummary } from '@/types/api'

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
  listings?: ListingSummary[] // from `listings` events, for cards
  tool?: ChatToolName // the latest tool started, for a "Searching…" hint
  leadCreated?: boolean // a `lead_created` event arrived in this reply
  pending?: boolean // the reply is still streaming
}

export type ChatStatus = 'idle' | 'streaming' | 'error'

export interface ChatState {
  messages: ChatMessage[]
  status: ChatStatus
  error: string | null
}

export interface UseChat extends ChatState {
  send: (text: string) => Promise<void>
  reset: () => void
}

const VISITOR_KEY = 'brickbot.visitor_id'
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
}

export interface Chat {
  getState: () => ChatState
  subscribe: (listener: () => void) => () => void
  send: (text: string) => Promise<void>
  // Aborts the reply in flight, keeping the conversation.
  abort: () => void
  // Aborts the reply in flight and starts a new conversation.
  reset: () => void
}

const INITIAL: ChatState = { messages: [], status: 'idle', error: null }

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof TypeError) return "Couldn't reach the server. Check your connection and try again."
  return 'Something went wrong. Please try again.'
}

// createChat holds one visitor's conversation outside React, so the turn logic
// is testable without a DOM. useChat subscribes to it.
export function createChat({ visitorId, createSession, stream = streamChatMessage }: ChatDeps): Chat {
  let state = INITIAL
  let sessionId: string | null = null
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
      sessionId = id
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
      if (err instanceof ApiError && err.status === 404) sessionId = null
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

  function reset() {
    inflight?.abort()
    inflight = null
    sessionId = null
    set(INITIAL)
  }

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    send,
    abort,
    reset,
  }
}

// useChat runs the visitor chatbot: it creates a session on the first
// message and streams replies into messages.
export function useChat(): UseChat {
  // mutateAsync is stable: it is bound to the mutation observer.
  const { mutateAsync: createSession } = useCreateChatSession()
  const [chat] = useState(() => createChat({ visitorId: getVisitorId(), createSession }))
  useEffect(() => chat.abort, [chat])
  const state = useSyncExternalStore(chat.subscribe, chat.getState)
  return { ...state, send: chat.send, reset: chat.reset }
}
