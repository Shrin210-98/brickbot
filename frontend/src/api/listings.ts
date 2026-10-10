import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { toSearchParams } from '@/lib/listing-filters'
import type {
  FeaturedListings,
  ListingDetail,
  ListingFacets,
  ListingQuery,
  ListingSummary,
  Paginated,
} from '@/types/api'

export const LISTINGS_PAGE_SIZE = 12

export function useListings(query: ListingQuery) {
  const params = toSearchParams(query)
  params.set('page', String(query.page))
  params.set('page_size', String(LISTINGS_PAGE_SIZE))
  return useQuery({
    queryKey: ['listings', 'list', query],
    queryFn: ({ signal }) => apiFetch<Paginated<ListingSummary>>(`/api/listings?${params}`, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useFeaturedListings() {
  return useQuery({
    queryKey: ['listings', 'featured'],
    queryFn: ({ signal }) => apiFetch<FeaturedListings>('/api/listings/featured', { signal }),
  })
}

export function useListingFacets() {
  return useQuery({
    queryKey: ['listings', 'facets'],
    queryFn: ({ signal }) => apiFetch<ListingFacets>('/api/listings/facets', { signal }),
  })
}

export function useListing(slug: string) {
  return useQuery({
    queryKey: ['listings', 'detail', slug],
    queryFn: ({ signal }) => apiFetch<ListingDetail>(`/api/listings/${encodeURIComponent(slug)}`, { signal }),
  })
}
