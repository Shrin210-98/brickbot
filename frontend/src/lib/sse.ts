import { API_TIMEOUT_MS, ApiError, withDeadline } from '@/lib/api'
import type { ApiErrorBody } from '@/types/api'

export interface SSEHandlers<TEvent> {
  onEvent: (event: string, data: TEvent) => void
  signal?: AbortSignal
}

// POSTs body as JSON and parses the text/event-stream reply, calling onEvent
// for each event with its JSON data. EventSource cannot POST, hence fetch.
// Resolves when the stream ends. Throws ApiError when the server answers with
// an error before the stream starts or with something that is not a stream,
// and rethrows network failures, aborts (AbortError) and malformed events.
// Connecting times out after API_TIMEOUT_MS (TimeoutError); once the stream
// has started it runs until it ends or handlers.signal aborts it.
export async function streamSSE<TEvent>(url: string, body: unknown, handlers: SSEHandlers<TEvent>): Promise<void> {
  const deadline = withDeadline(handlers.signal, API_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'text/event-stream', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: deadline.signal,
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as ApiErrorBody | null
      throw new ApiError(res.status, err?.error.code ?? 'internal', err?.error.message ?? res.statusText, err?.error.fields)
    }
  } finally {
    deadline.clear()
  }
  if (!res.body || !res.headers.get('Content-Type')?.startsWith('text/event-stream')) {
    await res.body?.cancel()
    throw new ApiError(res.status, 'internal', 'Expected an event stream')
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      // A "\r" at the end of a chunk waits here until its "\n" arrives.
      buf = (buf + value).replace(/\r\n/g, '\n')
      let end
      while ((end = buf.indexOf('\n\n')) >= 0) {
        dispatch(buf.slice(0, end), handlers.onEvent)
        buf = buf.slice(end + 2)
      }
    }
    // The stream may end without the final blank line.
    if (buf.trim() !== '') dispatch(buf, handlers.onEvent)
  } finally {
    // Closes the connection when parsing or a handler threw; a no-op after the end.
    await reader.cancel().catch(() => undefined)
  }
}

// dispatch parses one event block: "event:" sets the name, "data:" lines are
// joined with "\n", lines starting with ":" are comments.
function dispatch<TEvent>(block: string, onEvent: (event: string, data: TEvent) => void) {
  let event = 'message'
  const data: string[] = []
  for (const line of block.split('\n')) {
    if (line === '' || line.startsWith(':')) continue
    const colon = line.indexOf(':')
    const field = colon < 0 ? line : line.slice(0, colon)
    let value = colon < 0 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
  }
  if (data.length === 0) return
  let parsed: TEvent
  try {
    parsed = JSON.parse(data.join('\n')) as TEvent
  } catch {
    throw new Error(`Malformed data in "${event}" event`)
  }
  onEvent(event, parsed)
}
