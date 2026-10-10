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

// Fetch wrapper for /api. Throws ApiError for every non-2xx response.
// A 204 resolves to undefined, so callers expecting no body should use T = void.
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
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
}

// Sends FormData as multipart (the browser sets the boundary) and anything else as JSON.
export function apiSend<T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  if (body instanceof FormData) return apiFetch<T>(path, { method, body })
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
