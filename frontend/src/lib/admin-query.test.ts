import { describe, expect, it } from 'vitest'
import { INQUIRY_STATUSES, parseAdminQuery, toAdminSearchParams } from '@/lib/admin-query'

const parse = (search: string) => parseAdminQuery(new URLSearchParams(search), INQUIRY_STATUSES)

describe('parseAdminQuery', () => {
  it('reads status and page', () => {
    expect(parse('status=contacted&page=3')).toEqual({ status: 'contacted', page: 3 })
  })

  it.each(['status=draft', 'status=', 'page=0', 'page=-2', 'page=1.5', 'page=abc', 'page=10001'])(
    'drops invalid %s',
    (search) => {
      expect(parse(search)).toEqual({ status: undefined, page: 1 })
    },
  )
})

describe('toAdminSearchParams', () => {
  it('omits defaults', () => {
    expect(toAdminSearchParams({ page: 1 }).toString()).toBe('')
    expect(toAdminSearchParams({ status: 'spam', page: 2 }).toString()).toBe('status=spam&page=2')
  })

  it('round-trips through parse', () => {
    const query = { status: 'new' as const, page: 4 }
    expect(parse(toAdminSearchParams(query).toString())).toEqual(query)
  })
})
