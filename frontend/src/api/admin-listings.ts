import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiSend } from '@/lib/api'
import type {
  AdminListQuery,
  ListingDetail,
  ListingMedia,
  ListingStatus,
  ListingSummary,
  ListingWrite,
  MediaOrder,
  Paginated,
} from '@/types/api'

export const ADMIN_PAGE_SIZE = 20

const base = (id: string) => `/api/admin/listings/${encodeURIComponent(id)}`

// Every admin write can change what the public site shows (status, cover, fields),
// so both caches are invalidated.
function useInvalidateListings() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['admin', 'listings'] }),
      qc.invalidateQueries({ queryKey: ['listings'] }),
    ])
}

export function useAdminListings(query: AdminListQuery<ListingStatus>) {
  const params = new URLSearchParams({ page: String(query.page), page_size: String(ADMIN_PAGE_SIZE) })
  if (query.status) params.set('status', query.status)
  return useQuery({
    queryKey: ['admin', 'listings', 'list', query],
    queryFn: ({ signal }) => apiFetch<Paginated<ListingSummary>>(`/api/admin/listings?${params}`, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useAdminListing(id: string) {
  return useQuery({
    queryKey: ['admin', 'listings', 'detail', id],
    queryFn: ({ signal }) => apiFetch<ListingDetail>(base(id), { signal }),
  })
}

export function useCreateListing() {
  const invalidate = useInvalidateListings()
  return useMutation({
    mutationFn: (body: ListingWrite) => apiSend<ListingDetail>('POST', '/api/admin/listings', body),
    onSuccess: invalidate,
  })
}

export function useUpdateListing(id: string) {
  const invalidate = useInvalidateListings()
  return useMutation({
    mutationFn: (body: ListingWrite) => apiSend<ListingDetail>('PUT', base(id), body),
    onSuccess: invalidate,
  })
}

export function useDeleteListing() {
  const invalidate = useInvalidateListings()
  return useMutation({
    mutationFn: (id: string) => apiSend<void>('DELETE', base(id)),
    // Not awaited: the caller navigates away, and awaiting would first refetch the
    // still-mounted detail query into a 404.
    onSuccess: () => void invalidate(),
  })
}

function fileForm(file: File): FormData {
  const form = new FormData()
  form.append('file', file)
  return form
}

export function useUploadMedia(listingId: string) {
  const invalidate = useInvalidateListings()
  return useMutation({
    mutationFn: (file: File) => apiSend<ListingMedia>('POST', `${base(listingId)}/media`, fileForm(file)),
    onSettled: invalidate,
  })
}

export function useReplaceMedia(listingId: string) {
  const invalidate = useInvalidateListings()
  return useMutation({
    mutationFn: ({ mediaId, file }: { mediaId: string; file: File }) =>
      apiSend<ListingMedia>('PUT', `${base(listingId)}/media/${encodeURIComponent(mediaId)}`, fileForm(file)),
    onSuccess: invalidate,
  })
}

export function useReorderMedia(listingId: string) {
  const invalidate = useInvalidateListings()
  return useMutation({
    mutationFn: (body: MediaOrder) => apiSend<void>('PATCH', `${base(listingId)}/media/order`, body),
    // Refetch on failure too: a 422 means our copy of the media list is stale.
    onSettled: invalidate,
  })
}

export function useDeleteMedia(listingId: string) {
  const invalidate = useInvalidateListings()
  return useMutation({
    mutationFn: (mediaId: string) => apiSend<void>('DELETE', `${base(listingId)}/media/${encodeURIComponent(mediaId)}`),
    onSuccess: invalidate,
  })
}
