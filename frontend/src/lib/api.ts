import type { ApiErrorBody } from '@/types/api'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields?: Record<string, string>

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

// Default deadline for an API call: until the whole body has arrived for
// apiFetch, until the response headers for an SSE stream.
export const API_TIMEOUT_MS = 10_000
// Uploads carry user-sized files, so they get longer.
const UPLOAD_TIMEOUT_MS = 5 * 60_000

// Combines the caller's signal with a deadline that rejects with a
// "TimeoutError" DOMException. Unlike AbortSignal.timeout, clear() cancels the
// deadline, so an SSE stream can outlive it once connected; the caller's
// signal still aborts it.
export function withDeadline(signal: AbortSignal | null | undefined, ms: number) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new DOMException('The request timed out', 'TimeoutError')), ms)
  if (signal?.aborted) ctrl.abort(signal.reason)
  else signal?.addEventListener('abort', () => ctrl.abort(signal.reason), { once: true })
  return { signal: ctrl.signal, clear: () => clearTimeout(timer) }
}

// Fetch wrapper for /api. Throws ApiError for every non-2xx response, and
// rejects with a TimeoutError DOMException after timeoutMs (see isNetworkError).
// A 204 resolves to undefined, so callers expecting no body should use T = void.
export async function apiFetch<T>(path: string, init?: RequestInit, timeoutMs = API_TIMEOUT_MS): Promise<T> {
  const deadline = withDeadline(init?.signal, timeoutMs)
  try {
    const res = await fetch(path, {
      ...init,
      signal: deadline.signal,
      credentials: 'include',
      headers: { Accept: 'application/json', ...init?.headers },
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiErrorBody | null
      throw new ApiError(
        res.status,
        body?.error.code ?? 'internal',
        body?.error.message ?? res.statusText,
        body?.error.fields,
      )
    }
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  } finally {
    deadline.clear()
  }
}

// Sends FormData as multipart (the browser sets the boundary) and anything else as JSON.
export function apiSend<T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  if (body instanceof FormData) return apiFetch<T>(path, { method, body }, UPLOAD_TIMEOUT_MS)
  return apiFetch<T>(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiSend<T>('POST', path, body)
}

export function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404
}

// No response arrived: fetch rejects with a TypeError when the network or
// server is unreachable (and the service worker had nothing cached), and with
// a TimeoutError DOMException when withDeadline gave up waiting.
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof DOMException && err.name === 'TimeoutError')
}

// The browser says it has no network. A true onLine proves nothing (captive
// portals, a dead server), so pair it with isNetworkError for "can't reach".
export function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

// A network error, or the browser reports itself offline.
export function isOffline(err: unknown): boolean {
  return isNetworkError(err) || isBrowserOffline()
}
