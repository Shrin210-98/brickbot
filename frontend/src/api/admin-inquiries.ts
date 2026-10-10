import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ADMIN_PAGE_SIZE } from '@/api/admin-listings'
import { apiFetch, apiSend } from '@/lib/api'
import type { AdminListQuery, Inquiry, InquiryStatus, InquiryUpdate, Paginated } from '@/types/api'

export function useAdminInquiries(query: AdminListQuery<InquiryStatus>) {
  const params = new URLSearchParams({ page: String(query.page), page_size: String(ADMIN_PAGE_SIZE) })
  if (query.status) params.set('status', query.status)
  return useQuery({
    queryKey: ['admin', 'inquiries', 'list', query],
    queryFn: ({ signal }) => apiFetch<Paginated<Inquiry>>(`/api/admin/inquiries?${params}`, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useAdminInquiry(id: string) {
  return useQuery({
    queryKey: ['admin', 'inquiries', 'detail', id],
    queryFn: ({ signal }) => apiFetch<Inquiry>(`/api/admin/inquiries/${encodeURIComponent(id)}`, { signal }),
  })
}

export function useUpdateInquiry(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: InquiryUpdate) => apiSend<Inquiry>('PATCH', `/api/admin/inquiries/${encodeURIComponent(id)}`, body),
    onSuccess: (inquiry) => {
      qc.setQueryData(['admin', 'inquiries', 'detail', id], inquiry)
      return qc.invalidateQueries({ queryKey: ['admin', 'inquiries', 'list'] })
    },
  })
}
