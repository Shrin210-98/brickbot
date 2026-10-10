import type { ListingQuery, ListingSort, PropertyType, Purpose } from '@/types/api'

// Listing filters live in the URL. Param names match GET /api/listings, so the
// same search string is forwarded to the API. Invalid values are dropped rather
// than sent, to avoid 400/422 from hand-edited URLs.

const PURPOSES: readonly Purpose[] = ['sale', 'rent']
const PROPERTY_TYPES: readonly PropertyType[] = ['apartment', 'house', 'villa', 'plot', 'commercial', 'other']
const SORTS: readonly ListingSort[] = ['newest', 'price_asc', 'price_desc']

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined
}

function int(value: string | null, min: number, max: number): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined
  const n = Number(value)
  return n >= min && n <= max ? n : undefined
}

function text(value: string | null): string | undefined {
  const v = value?.trim()
  return v ? v.slice(0, 100) : undefined
}

export function parseListingQuery(params: URLSearchParams): ListingQuery {
  const query: ListingQuery = {
    purpose: oneOf(params.get('purpose'), PURPOSES),
    type: oneOf(params.get('type'), PROPERTY_TYPES),
    city: text(params.get('city')),
    locality: text(params.get('locality')),
    min_price: int(params.get('min_price'), 0, Number.MAX_SAFE_INTEGER),
    max_price: int(params.get('max_price'), 0, Number.MAX_SAFE_INTEGER),
    beds: int(params.get('beds'), 0, 50),
    q: text(params.get('q')),
    sort: oneOf(params.get('sort'), SORTS),
    page: int(params.get('page'), 1, 10000) ?? 1,
  }
  if (query.min_price !== undefined && query.max_price !== undefined && query.min_price > query.max_price) {
    query.max_price = undefined
  }
  return query
}

// Omits unset values and defaults (page 1) so URLs stay short.
export function toSearchParams(query: ListingQuery): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '' || (key === 'page' && value === 1)) continue
    params.set(key, String(value))
  }
  return params
}

// True when anything other than page/sort narrows the results.
export function hasActiveFilters(query: ListingQuery): boolean {
  return Object.entries(query).some(([key, value]) => key !== 'page' && key !== 'sort' && value !== undefined)
}
