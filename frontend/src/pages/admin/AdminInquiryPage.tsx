import { ArrowLeft, Mail, Phone } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAdminInquiry } from '@/api/admin-inquiries'
import { useMarket } from '@/api/profile'
import { InquiryStatusBadge } from '@/components/admin/InquiryStatusBadge'
import { InquiryTriageForm } from '@/components/admin/InquiryTriageForm'
import { ApiErrorState } from '@/components/errors/ApiErrorState'
import { EmptyState } from '@/components/listings/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { isNotFound } from '@/lib/api'
import { formatDateTime } from '@/lib/format'

function BackLink() {
  return (
    <Button variant="ghost" className="self-start" nativeButton={false} render={<Link to="/admin/inquiries" />}>
      <ArrowLeft data-icon="inline-start" /> Inquiries
    </Button>
  )
}

export function AdminInquiryPage() {
  const { id = '' } = useParams()
  const { data: inquiry, isPending, error, refetch } = useAdminInquiry(id)
  const market = useMarket()

  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        {isNotFound(error) ? (
          <EmptyState title="Inquiry not found" />
        ) : (
          <ApiErrorState error={error} title="Couldn't load this inquiry" onRetry={() => void refetch()} />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <title>{`${inquiry.name} | Inquiries | Admin`}</title>
      <BackLink />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{inquiry.name}</h1>
        <InquiryStatusBadge status={inquiry.status} />
        <Badge variant="outline">{inquiry.source === 'chat' ? 'Chat' : 'Form'}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Inquiry</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">Received {formatDateTime(inquiry.created_at, market)}</p>
            <div className="flex flex-wrap gap-2">
              {inquiry.phone && (
                <Button variant="outline" nativeButton={false} render={<a href={`tel:${inquiry.phone}`} />}>
                  <Phone data-icon="inline-start" /> {inquiry.phone}
                </Button>
              )}
              {inquiry.email && (
                <Button variant="outline" nativeButton={false} render={<a href={`mailto:${inquiry.email}`} />}>
                  <Mail data-icon="inline-start" /> {inquiry.email}
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Listing</p>
              {inquiry.listing ? (
                <Link to={`/admin/listings/${inquiry.listing.id}`} className="text-sm hover:underline">
                  {inquiry.listing.title}
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">General inquiry</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Message</p>
              <p className="text-sm whitespace-pre-line text-muted-foreground">
                {inquiry.message || 'No message.'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:self-start">
          <CardHeader>
            <CardTitle>Triage</CardTitle>
          </CardHeader>
          <CardContent>
            <InquiryTriageForm key={inquiry.id} inquiry={inquiry} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
