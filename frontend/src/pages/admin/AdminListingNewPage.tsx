import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useCreateListing } from '@/api/admin-listings'
import { ListingForm } from '@/components/admin/ListingForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function AdminListingNewPage() {
  const create = useCreateListing()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6">
      <title>New listing | Admin</title>
      <Button variant="ghost" className="self-start" nativeButton={false} render={<Link to="/admin/listings" />}>
        <ArrowLeft data-icon="inline-start" /> Listings
      </Button>
      <div>
        <h1 className="text-2xl font-semibold">New listing</h1>
        <p className="text-sm text-muted-foreground">You can add photos after saving.</p>
      </div>
      <Card>
        <CardContent>
          <ListingForm
            submitLabel="Create listing"
            onSubmit={async (values) => {
              const listing = await create.mutateAsync(values)
              navigate(`/admin/listings/${listing.id}`, { replace: true })
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
