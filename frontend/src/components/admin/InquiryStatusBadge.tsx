import { Badge } from '@/components/ui/badge'
import { INQUIRY_STATUS_LABELS } from '@/lib/format'
import type { InquiryStatus } from '@/types/api'

const VARIANTS = {
  new: 'default',
  contacted: 'secondary',
  closed: 'outline',
  spam: 'destructive',
} as const satisfies Record<InquiryStatus, string>

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  return <Badge variant={VARIANTS[status]}>{INQUIRY_STATUS_LABELS[status]}</Badge>
}
