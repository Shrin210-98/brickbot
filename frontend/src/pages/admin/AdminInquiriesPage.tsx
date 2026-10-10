import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAdminInquiries } from '@/api/admin-inquiries'
import { ADMIN_PAGE_SIZE } from '@/api/admin-listings'
import { useMarket } from '@/api/profile'
import { InquiryStatusBadge } from '@/components/admin/InquiryStatusBadge'
import { StatusFilter } from '@/components/admin/StatusFilter'
import { EmptyState } from '@/components/listings/EmptyState'
import { ListingPagination } from '@/components/listings/ListingPagination'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { INQUIRY_STATUSES, parseAdminQuery, toAdminSearchParams } from '@/lib/admin-query'
import { formatDateTime, INQUIRY_STATUS_LABELS } from '@/lib/format'
import type { AdminListQuery, InquiryStatus } from '@/types/api'

export function AdminInquiriesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = parseAdminQuery(searchParams, INQUIRY_STATUSES)
  const inquiries = useAdminInquiries(query)
  const market = useMarket()
  const navigate = useNavigate()

  const setQuery = (next: AdminListQuery<InquiryStatus>) => setSearchParams(toAdminSearchParams(next))
  const hrefFor = (page: number) => `?${toAdminSearchParams({ ...query, page })}`
  const pageCount = Math.ceil((inquiries.data?.total ?? 0) / ADMIN_PAGE_SIZE)

  return (
    <div className="flex flex-col gap-6">
      <title>Inquiries | Admin</title>
      <h1 className="text-2xl font-semibold">Inquiries</h1>

      <StatusFilter
        statuses={INQUIRY_STATUSES}
        labels={INQUIRY_STATUS_LABELS}
        value={query.status}
        onChange={(status) => setQuery({ status, page: 1 })}
      />

      {inquiries.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load inquiries</AlertTitle>
          <AlertDescription>{inquiries.error.message}</AlertDescription>
        </Alert>
      ) : inquiries.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : inquiries.data.items.length === 0 ? (
        <EmptyState
          title={query.status ? `No ${INQUIRY_STATUS_LABELS[query.status].toLowerCase()} inquiries` : 'No inquiries yet'}
          description="Inquiries from the contact form and listing pages show up here."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Received</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Contact</TableHead>
              <TableHead className="hidden lg:table-cell">Listing</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inquiries.data.items.map((q) => (
              <TableRow
                key={q.id}
                className="cursor-pointer"
                onClick={() => navigate(`/admin/inquiries/${q.id}`)}
              >
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDateTime(q.created_at, market)}
                </TableCell>
                <TableCell>
                  <Link
                    to={`/admin/inquiries/${q.id}`}
                    className="font-medium hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {q.name}
                  </Link>
                </TableCell>
                <TableCell className="hidden md:table-cell">{q.phone || q.email}</TableCell>
                <TableCell className="hidden max-w-xs truncate lg:table-cell">
                  {q.listing?.title ?? <span className="text-muted-foreground">General</span>}
                </TableCell>
                <TableCell>
                  <InquiryStatusBadge status={q.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ListingPagination
        page={query.page}
        pageCount={pageCount}
        hrefFor={hrefFor}
        onPageChange={(page) => setQuery({ ...query, page })}
      />
    </div>
  )
}
