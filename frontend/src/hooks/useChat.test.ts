import { afterEach, describe, expect, it, vi } from 'vitest'
import { createChatSession } from '@/api/chat'
import { ApiError } from '@/lib/api'
import { streamSSE } from '@/lib/sse'
import { createChat, getVisitorId } from '@/hooks/useChat'
import type { ListingSummary } from '@/types/api'

const VISITOR = '0b6c2f1e-6d7a-4c3b-9a51-2f6d8e4b7c10'
const enc = new TextEncoder()

// An SSE response whose frames the test pushes. Like a real fetch body, it
// errors with the abort reason when the request signal aborts.
function sseResponse(signal?: AbortSignal | null) {
  let ctl!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start: (c) => void (ctl = c) })
  signal?.addEventListener('abort', () => ctl.error(signal.reason))
  return {
    response: new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }),
    raw: (s: string) => ctl.enqueue(enc.encode(s)),
    emit: (event: string, data: unknown) => ctl.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)),
    close: () => ctl.close(),
    // done is always the last event; the server then closes the stream.
    finish: () => {
      ctl.enqueue(enc.encode('event: done\ndata: {}\n\n'))
      ctl.close()
    },
  }
}

type Stream = ReturnType<typeof sseResponse>

// Mocks fetch: session creation answers JSON, each message POST opens a new
// SSE stream, returned through `streams`.
function mockChatApi() {
  const streams: Stream[] = []
  const signals: (AbortSignal | null | undefined)[] = []
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    if (url === '/api/chat/sessions') {
      return Response.json({ id: 's-1', created_at: '2026-10-11T10:00:00Z' }, { status: 201 })
    }
    signals.push(init?.signal)
    const s = sseResponse(init?.signal)
    streams.push(s)
    return s.response
  })
  vi.stubGlobal('fetch', fetchMock)
  const chat = createChat({ visitorId: VISITOR, createSession: createChatSession })
  // The stream for the nth message, once its POST has been made.
  const stream = async (n = 0) => {
    await vi.waitFor(() => expect(streams[n]).toBeDefined())
    return streams[n]
  }
  return { chat, fetchMock, stream, signals }
}

const listing = { id: 'l-1', slug: '3bhk-bandra', title: '3 BHK in Bandra' } as ListingSummary

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getVisitorId', () => {
  it('creates a UUID once and persists it', () => {
    const store = new Map<string, string>()
    const setItem = vi.fn((k: string, v: string) => void store.set(k, v))
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem })

    const id = getVisitorId()
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(getVisitorId()).toBe(id)
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(store.get('brickbot.visitor_id')).toBe(id)
  })

  it('keeps the id in memory when localStorage throws', () => {
    const blocked = () => {
      throw new DOMException('denied', 'SecurityError')
    }
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked })
    const id = getVisitorId()
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(getVisitorId()).toBe(id)
  })
})

describe('createChat', () => {
  it('appends the user turn before any request resolves', async () => {
    const { chat, stream } = mockChatApi()
    const sent = chat.send('  2 BHK in Bandra?  ')

    expect(chat.getState().status).toBe('streaming')
    expect(chat.getState().messages).toEqual([
      { id: 1, role: 'user', text: '2 BHK in Bandra?' },
      { id: 2, role: 'assistant', text: '', pending: true },
    ])
    ;(await stream()).finish()
    await sent
  })

  it('appends delta text to the assistant turn as it streams', async () => {
    const { chat, stream, fetchMock } = mockChatApi()
    const sent = chat.send('hi')
    const s = await stream()
    s.emit('delta', { text: 'Here are ' })
    s.emit('delta', { text: 'two options' })

    await vi.waitFor(() => expect(chat.getState().messages[1]).toMatchObject({ text: 'Here are two options', pending: true }))
    s.finish()
    await sent

    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('/api/chat/sessions/s-1/messages')
    expect(JSON.parse(String(init?.body))).toEqual({ visitor_id: VISITOR, content: 'hi' })
  })

  it('attaches listings, the tool and the lead to the last assistant turn', async () => {
    const { chat, stream } = mockChatApi()
    const sent = chat.send('show me flats')
    const s = await stream()
    s.emit('tool', { name: 'search_listings' })
    s.emit('listings', { items: [listing] })
    s.emit('lead_created', { inquiry_id: 'i-1' })
    s.finish()
    await sent

    expect(chat.getState().messages[1]).toEqual({
      id: 2,
      role: 'assistant',
      text: '',
      tool: 'search_listings',
      listings: [listing],
      leadCreated: true,
      pending: false,
    })
  })

  it('done sets status idle and the next message reuses the session', async () => {
    const { chat, stream, fetchMock } = mockChatApi()
    const first = chat.send('hi')
    const s = await stream()
    s.emit('delta', { text: 'Hello!' })
    s.finish()
    await first
    expect(chat.getState()).toMatchObject({ status: 'idle', error: null })
    expect(chat.getState().messages[1]).toMatchObject({ text: 'Hello!', pending: false })

    const second = chat.send('again')
    ;(await stream(1)).finish()
    await second
    const sessionPosts = fetchMock.mock.calls.filter(([u]) => u === '/api/chat/sessions')
    expect(sessionPosts).toHaveLength(1)
  })

  it('an error event sets status error and keeps the partial text and user turn', async () => {
    const { chat, stream } = mockChatApi()
    const sent = chat.send('hi')
    const s = await stream()
    s.emit('delta', { text: 'Partial ans' })
    s.emit('error', { code: 'upstream', message: 'The assistant is unavailable right now.' })
    s.close()
    await sent

    expect(chat.getState()).toEqual({
      status: 'error',
      error: 'The assistant is unavailable right now.',
      messages: [
        { id: 1, role: 'user', text: 'hi' },
        { id: 2, role: 'assistant', text: 'Partial ans', pending: false },
      ],
    })
  })

  it('a stream that ends without done or error is an error', async () => {
    const { chat, stream } = mockChatApi()
    const sent = chat.send('hi')
    const s = await stream()
    s.emit('delta', { text: 'Cut' })
    s.close()
    await sent
    expect(chat.getState()).toMatchObject({ status: 'error', error: 'The reply was cut off. Please try again.' })
    expect(chat.getState().messages[1]).toMatchObject({ text: 'Cut', pending: false })
  })

  it('a network failure sets status error and drops the empty reply', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    const chat = createChat({ visitorId: VISITOR, createSession: createChatSession })
    await chat.send('hi')
    expect(chat.getState()).toEqual({
      status: 'error',
      error: "Couldn't reach the server. Check your connection and try again.",
      messages: [{ id: 1, role: 'user', text: 'hi' }],
    })
  })

  it('reset() aborts the stream in flight and ignores late events', async () => {
    const { chat, stream, signals } = mockChatApi()
    const sent = chat.send('hi')
    const s = await stream()
    s.emit('delta', { text: 'Half' })
    await vi.waitFor(() => expect(chat.getState().messages[1]?.text).toBe('Half'))

    chat.reset()
    expect(signals[0]?.aborted).toBe(true)
    await expect(sent).resolves.toBeUndefined()
    expect(chat.getState()).toEqual({ messages: [], status: 'idle', error: null })
  })
})

describe('streamSSE', () => {
  it('parses events split across chunks, CRLF line ends and multi-line data', async () => {
    const s = sseResponse()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => s.response))
    const events: [string, unknown][] = []
    const done = streamSSE('/x', {}, { onEvent: (e, d) => events.push([e, d]) })

    s.raw(': comment\r\nevent: del')
    s.raw('ta\r\ndata: {"text":\r')
    s.raw('\ndata: "a"}\r\n\r\nevent: done\ndata: {}')
    s.close()
    await done
    expect(events).toEqual([
      ['delta', { text: 'a' }],
      ['done', {}],
    ])
  })

  it('throws ApiError from a JSON error sent before the stream', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        Response.json({ error: { code: 'conflict', message: 'A reply is already streaming' } }, { status: 409 }),
      ),
    )
    const err = await streamSSE('/x', {}, { onEvent: () => {} }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 409, code: 'conflict', message: 'A reply is already streaming' })
  })

  it('throws on a 200 that is not an event stream', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => Response.json({})))
    await expect(streamSSE('/x', {}, { onEvent: () => {} })).rejects.toMatchObject({ code: 'internal' })
  })

  it('throws on malformed event data', async () => {
    const s = sseResponse()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => s.response))
    const done = streamSSE('/x', {}, { onEvent: () => {} })
    s.raw('event: delta\ndata: {nope\n\n')
    await expect(done).rejects.toThrow('Malformed data in "delta" event')
  })
})
