import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api'
import { applyFieldErrors } from '@/lib/form-errors'

type Values = { phone: string; listing_slug: string }

describe('applyFieldErrors', () => {
  it('sets known fields with a readable message', () => {
    const setError = vi.fn()
    const err = new ApiError(422, 'validation_failed', 'Request validation failed', {
      phone: 'must be a valid phone number',
      listing_slug: 'must be at most 120 characters',
      unknown: 'is invalid',
    })

    expect(applyFieldErrors<Values>(err, setError, ['phone', 'listing_slug'])).toBe(true)
    expect(setError.mock.calls).toEqual([
      ['phone', { type: 'server', message: 'Phone must be a valid phone number' }],
      ['listing_slug', { type: 'server', message: 'Listing slug must be at most 120 characters' }],
    ])
  })

  it('returns false when no field matches', () => {
    const setError = vi.fn()
    const err = new ApiError(422, 'validation_failed', 'x', { other: 'is required' })
    expect(applyFieldErrors<Values>(err, setError, ['phone'])).toBe(false)
    expect(setError).not.toHaveBeenCalled()
  })

  it('ignores non-422 and non-ApiError errors', () => {
    const setError = vi.fn()
    expect(applyFieldErrors<Values>(new ApiError(401, 'unauthorized', 'x'), setError, ['phone'])).toBe(false)
    expect(applyFieldErrors<Values>(new Error('boom'), setError, ['phone'])).toBe(false)
    expect(setError).not.toHaveBeenCalled()
  })
})
