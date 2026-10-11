import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAdminListing, useDeleteListing, useUpdateListing } from '@/api/admin-listings'
import { ConfirmDelete } from '@/components/admin/ConfirmDelete'
import { ListingForm } from '@/components/admin/ListingForm'
import { MediaManager } from '@/components/admin/MediaManager'
import { ApiErrorState } from '@/components/errors/ApiErrorState'
import { EmptyState } from '@/components/listings/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { isNotFound } from '@/lib/api'
import { LISTING_STATUS_LABELS } from '@/lib/format'

function BackLink() {
  return (
    <Button variant="ghost" className="self-start" nativeButton={false} render={<Link to="/admin/listings" />}>
      <ArrowLeft data-icon="inline-start" /> Listings
    </Button>
  )
}

export function AdminListingEditPage() {
  const { id = '' } = useParams()
  const { data: listing, isPending, error, refetch } = useAdminListing(id)
  const update = useUpdateListing(id)
  const remove = useDeleteListing()
  const navigate = useNavigate()

  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        {isNotFound(error) ? (
          <EmptyState title="Listing not found" description="It may have been deleted." />
        ) : (
          <ApiErrorState error={error} title="Couldn't load this listing" onRetry={() => void refetch()} />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <title>{`${listing.title} | Admin`}</title>
      <BackLink />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{listing.title}</h1>
          <Badge variant={listing.status === 'active' ? 'default' : 'secondary'}>
            {LISTING_STATUS_LABELS[listing.status]}
          </Badge>
        </div>
        {listing.status === 'active' && (
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={`/listings/${listing.slug}`} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLink data-icon="inline-start" /> View on site
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Photos</CardTitle>
          <CardDescription>The first photo is the cover. Use the arrows to reorder.</CardDescription>
        </CardHeader>
        <CardContent>
          <MediaManager listingId={listing.id} media={listing.media} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ListingForm
            key={listing.id}
            listing={listing}
            submitLabel="Save changes"
            onSubmit={(values) => update.mutateAsync(values)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delete listing</CardTitle>
          <CardDescription>
            It disappears from the site and the admin. Its slug stays reserved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfirmDelete
            title={`Delete "${listing.title}"?`}
            description="This can't be undone from the admin."
            onConfirm={async () => {
              await remove.mutateAsync(listing.id)
              navigate('/admin/listings', { replace: true })
            }}
            trigger={
              <Button variant="destructive">
                <Trash2 data-icon="inline-start" /> Delete listing
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
