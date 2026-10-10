import { useMutation } from '@tanstack/react-query'
import { apiPost } from '@/lib/api'
import type { InquiryCreate, InquiryCreated } from '@/types/api'

export function useCreateInquiry() {
  return useMutation({
    mutationFn: (body: InquiryCreate) => apiPost<InquiryCreated>('/api/inquiries', body),
  })
}
