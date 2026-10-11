import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api'
import { apiErrorMessage } from '@/lib/error-copy'

const api = (status: number) => new ApiError(status, 'x', 'raw server text')

describe('apiErrorMessage', () => {
  it.each([
    [new TypeError('Failed to fetch'), "Can't reach the server. Check your connection and try again."],
    [new DOMException('The request timed out', 'TimeoutError'), "Can't reach the server. Check your connection and try again."],
    [api(401), "You don't have access to this."],
    [api(403), "You don't have access to this."],
    [api(404), "We couldn't find that."],
    [api(429), 'Too many requests. Try again in a moment.'],
    [api(500), 'The server is having trouble. Please try again in a moment.'],
    [api(502), 'The server is having trouble. Please try again in a moment.'],
    [api(400), 'Something went wrong.'],
    [new Error('boom'), 'Something went wrong.'],
  ])('%s', (err, copy) => {
    expect(apiErrorMessage(err)).toBe(copy)
  })

  it('never echoes the raw message', () => {
    for (const status of [400, 401, 404, 429, 500]) expect(apiErrorMessage(api(status))).not.toContain('raw server text')
  })
})
