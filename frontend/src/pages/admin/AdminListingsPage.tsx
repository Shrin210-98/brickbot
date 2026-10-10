import { ExternalLink, ImageOff, Plus, Star, Trash2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { ADMIN_PAGE_SIZE, useAdminListings, useDeleteListing } from '@/api/admin-listings'
import { useMarket } from '@/api/profile'
import { ConfirmDelete } from '@/components/admin/ConfirmDelete'
import { StatusFilter } from '@/components/admin/StatusFilter'
import { EmptyState } from '@/components/listings/EmptyState'
import { ListingPagination } from '@/components/listings/ListingPagination'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LISTING_STATUSES, parseAdminQuery, toAdminSearchParams } from '@/lib/admin-query'
import { formatPrice, LISTING_STATUS_LABELS } from '@/lib/format'
import type { AdminListQuery, ListingStatus } from '@/types/api'

export function AdminListingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = parseAdminQuery(searchParams, LISTING_STATUSES)
  const listings = useAdminListings(query)
  const remove = useDeleteListing()
  const market = useMarket()

  const setQuery = (next: AdminListQuery<ListingStatus>) => setSearchParams(toAdminSearchParams(next))
  const hrefFor = (page: number) => `?${toAdminSearchParams({ ...query, page })}`
  const pageCount = Math.ceil((listings.data?.total ?? 0) / ADMIN_PAGE_SIZE)

  return (
    <div className="flex flex-col gap-6">
      <title>Listings | Admin</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Listings</h1>
        <Button nativeButton={false} render={<Link to="/admin/listings/new" />}>
          <Plus data-icon="inline-start" /> New listing
        </Button>
      </div>

      <StatusFilter
        statuses={LISTING_STATUSES}
        labels={LISTING_STATUS_LABELS}
        value={query.status}
        onChange={(status) => setQuery({ status, page: 1 })}
      />

      {listings.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load listings</AlertTitle>
          <AlertDescription>{listings.error.message}</AlertDescription>
        </Alert>
      ) : listings.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : listings.data.items.length === 0 ? (
        <EmptyState
          title={query.status ? `No ${LISTING_STATUS_LABELS[query.status].toLowerCase()} listings` : 'No listings yet'}
          description="Create a listing, then add photos and set it to Active to publish it."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Photo</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="hidden md:table-cell">Location</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {listings.data.items.map((l) => (
              <TableRow key={l.id}>
                <TableCell>
                  {l.cover_url ? (
                    <img src={l.cover_url} alt="" className="aspect-[4/3] w-16 rounded object-cover" />
                  ) : (
                    <div className="flex aspect-[4/3] w-16 items-center justify-center rounded bg-muted">
                      <ImageOff className="size-4 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="max-w-xs">
                  <Link to={`/admin/listings/${l.id}`} className="font-medium hover:underline">
                    {l.title}
                  </Link>
                  {l.featured && <Star className="ml-1 inline size-3.5 fill-current text-amber-500" aria-label="Featured" />}
                  <p className="truncate text-xs text-muted-foreground">{l.slug}</p>
                </TableCell>
                <TableCell>
                  <Badge variant={l.status === 'active' ? 'default' : 'secondary'}>{LISTING_STATUS_LABELS[l.status]}</Badge>
                </TableCell>
                <TableCell className="text-right">{formatPrice(l.price, l.purpose, market)}</TableCell>
                <TableCell className="hidden md:table-cell">{[l.locality, l.city].filter(Boolean).join(', ')}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {l.status === 'active' && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="View on site"
                        nativeButton={false}
                        render={<a href={`/listings/${l.slug}`} target="_blank" rel="noopener noreferrer" />}
                      >
                        <ExternalLink />
                      </Button>
                    )}
                    <ConfirmDelete
                      title={`Delete "${l.title}"?`}
                      description="It disappears from the site and the admin. Its slug stays reserved."
                      onConfirm={() => remove.mutateAsync(l.id)}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label="Delete listing">
                          <Trash2 />
                        </Button>
                      }
                    />
                  </div>
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
