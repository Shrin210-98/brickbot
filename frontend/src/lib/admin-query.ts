import type { AdminListQuery, InquiryStatus, ListingStatus } from '@/types/api'

// Admin list filters live in the URL (?status=…&page=…). Invalid values are
// dropped rather than sent, so a hand-edited URL never produces a 422.

export const LISTING_STATUSES = ['draft', 'active', 'sold', 'rented'] as const satisfies readonly ListingStatus[]
export const INQUIRY_STATUSES = ['new', 'contacted', 'closed', 'spam'] as const satisfies readonly InquiryStatus[]

export function parseAdminQuery<S extends string>(params: URLSearchParams, statuses: readonly S[]): AdminListQuery<S> {
  const status = params.get('status')
  const page = params.get('page')
  const n = page !== null && /^\d+$/.test(page) ? Number(page) : 1
  return {
    status: statuses.includes(status as S) ? (status as S) : undefined,
    page: n >= 1 && n <= 10000 ? n : 1,
  }
}

// Omits defaults (no status, page 1) so URLs stay short.
export function toAdminSearchParams<S extends string>(query: AdminListQuery<S>): URLSearchParams {
  const params = new URLSearchParams()
  if (query.status) params.set('status', query.status)
  if (query.page !== 1) params.set('page', String(query.page))
  return params
}
