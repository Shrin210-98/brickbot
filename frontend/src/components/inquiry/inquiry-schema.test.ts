import { describe, expect, it } from 'vitest'
import { inquirySchema } from './inquiry-schema'

const valid = { name: 'Asha', phone: '+91 98765 43210', email: '', message: '' }

function issuePaths(input: unknown): string[] {
  const res = inquirySchema.safeParse(input)
  return res.success ? [] : res.error.issues.map((i) => i.path.join('.'))
}

describe('inquirySchema', () => {
  it('accepts phone only, email only, or both', () => {
    expect(issuePaths(valid)).toEqual([])
    expect(issuePaths({ ...valid, phone: '', email: 'asha@example.com' })).toEqual([])
    expect(issuePaths({ ...valid, email: 'asha@example.com' })).toEqual([])
  })

  it('trims every field', () => {
    const res = inquirySchema.parse({ name: '  Asha ', phone: ' 9876543210 ', email: ' a@b.co ', message: ' hi ' })
    expect(res).toEqual({ name: 'Asha', phone: '9876543210', email: 'a@b.co', message: 'hi' })
  })

  it('requires phone or email, flagging both', () => {
    expect(issuePaths({ ...valid, phone: '  ' }).sort()).toEqual(['email', 'phone'])
  })

  it('requires a name', () => {
    expect(issuePaths({ ...valid, name: '   ' })).toEqual(['name'])
  })

  it.each([
    ['+91 98765 43210', true],
    ['022 2345-6789', true],
    ['(022) 2345-6789', false],
    ['9876543', true],
    ['12345', false],
    ['98765-', false],
    ['+', false],
    ['phone me', false],
    ['1'.repeat(21), false],
  ])('phone %s valid=%s', (phone, ok) => {
    expect(issuePaths({ ...valid, phone }).includes('phone')).toBe(!ok)
  })

  it('rejects an invalid email', () => {
    expect(issuePaths({ ...valid, email: 'not-an-email' })).toEqual(['email'])
  })

  it('enforces max lengths', () => {
    expect(issuePaths({ ...valid, name: 'a'.repeat(101) })).toEqual(['name'])
    expect(issuePaths({ ...valid, message: 'a'.repeat(2001) })).toEqual(['message'])
    expect(issuePaths({ ...valid, message: 'a'.repeat(2000) })).toEqual([])
  })
})
