import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_TIMEOUT_MS, ApiError, apiFetch, apiPost, apiSend, isNetworkError, isOffline } from '@/lib/api'

function mockFetch(res: Response) {
  const fn = vi.fn<typeof fetch>(async () => res)
  vi.stubGlobal('fetch', fn)
  return fn
}

// A fetch that never answers, and rejects with the abort reason like a real one.
function mockHangingFetch() {
  const fn = vi.fn<typeof fetch>(
    (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      }),
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('apiFetch', () => {
  it('parses a JSON body', async () => {
    mockFetch(Response.json({ email: 'a@b.co' }))
    await expect(apiFetch('/api/auth/me')).resolves.toEqual({ email: 'a@b.co' })
  })

  it('resolves 204 to undefined without reading the body', async () => {
    mockFetch(new Response(null, { status: 204 }))
    await expect(apiFetch<void>('/api/auth/logout')).resolves.toBeUndefined()
  })

  it('throws ApiError with fields from the error envelope', async () => {
    mockFetch(
      Response.json(
        { error: { code: 'validation_failed', message: 'Request validation failed', fields: { phone: 'is invalid' } } },
        { status: 422 },
      ),
    )
    const err = await apiFetch('/api/inquiries').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 422, code: 'validation_failed', fields: { phone: 'is invalid' } })
  })

  it('falls back to internal when the error body is not JSON', async () => {
    mockFetch(new Response('bad gateway', { status: 502, statusText: 'Bad Gateway' }))
    await expect(apiFetch('/api/profile')).rejects.toMatchObject({ status: 502, code: 'internal' })
  })
})

describe('apiPost', () => {
  it('sends a JSON body with credentials', async () => {
    const fn = mockFetch(new Response(null, { status: 204 }))
    await apiPost<void>('/api/auth/login', { email: 'a@b.co', password: 'pw' })
    const [path, init] = fn.mock.calls[0]
    expect(path).toBe('/api/auth/login')
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: '{"email":"a@b.co","password":"pw"}',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    })
  })

  it('omits the body when none is given', async () => {
    const fn = mockFetch(new Response(null, { status: 204 }))
    await apiPost<void>('/api/auth/logout')
    expect(fn.mock.calls[0][1]?.body).toBeUndefined()
  })
})

describe('apiSend', () => {
  it('passes FormData through without a Content-Type, so the browser sets the boundary', async () => {
    const fn = mockFetch(Response.json({ id: 'm1' }, { status: 201 }))
    const form = new FormData()
    form.append('file', new Blob(['x'], { type: 'image/png' }), 'a.png')
    await apiSend('POST', '/api/admin/listings/1/media', form)
    const init = fn.mock.calls[0][1]
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(form)
    expect(init?.headers).toEqual({ Accept: 'application/json' })
  })

  it('sends DELETE without a body or Content-Type', async () => {
    const fn = mockFetch(new Response(null, { status: 204 }))
    await apiSend<void>('DELETE', '/api/admin/listings/1')
    expect(fn.mock.calls[0][1]).toMatchObject({ method: 'DELETE', body: undefined, headers: { Accept: 'application/json' } })
  })
})

describe('apiFetch deadline', () => {
  it('rejects with a TimeoutError when the server never answers', async () => {
    vi.useFakeTimers()
    mockHangingFetch()
    const err = apiFetch('/api/listings').catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS)
    const e = await err
    expect(e).toBeInstanceOf(DOMException)
    expect((e as DOMException).name).toBe('TimeoutError')
    expect(isNetworkError(e)).toBe(true)
  })

  it("still aborts with the caller's signal, keeping its reason", async () => {
    mockHangingFetch()
    const ctrl = new AbortController()
    const err = apiFetch('/api/listings', { signal: ctrl.signal }).catch((e: unknown) => e)
    ctrl.abort()
    expect(((await err) as DOMException).name).toBe('AbortError')
  })
})

describe('isOffline', () => {
  it('is true for a fetch that got no response', () => {
    expect(isOffline(new TypeError('Failed to fetch'))).toBe(true)
  })
  it('is true for a timeout', () => {
    expect(isOffline(new DOMException('The request timed out', 'TimeoutError'))).toBe(true)
  })
  it('is false for an HTTP error while online', () => {
    expect(isOffline(new ApiError(500, 'internal', 'boom'))).toBe(false)
  })
})
