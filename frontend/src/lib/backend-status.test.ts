import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api'
import { isBackendDown } from '@/lib/backend-status'

const api = (status: number) => new ApiError(status, 'x', 'raw server text')

describe('isBackendDown', () => {
  it.each([
    [new TypeError('Failed to fetch'), true],
    [new DOMException('The request timed out', 'TimeoutError'), true],
    [api(500), true],
    [api(502), true],
    [api(530), true],
    [api(400), false],
    [api(401), false],
    [api(404), false],
    [api(429), false],
    [new DOMException('The user aborted a request', 'AbortError'), false],
    [new Error('boom'), false],
    [null, false],
  ])('%s → %s', (err, down) => {
    expect(isBackendDown(err)).toBe(down)
  })
})
