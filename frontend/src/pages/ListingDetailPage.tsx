import { ArrowLeft, Bath, BedDouble, Building2, MapPin, MessageCircle, Phone, Ruler } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useListing } from '@/api/listings'
import { useMarket, useProfile } from '@/api/profile'
import { InquiryForm } from '@/components/inquiry/InquiryForm'
import { EmptyState } from '@/components/listings/EmptyState'
import { ListingGallery } from '@/components/listings/ListingGallery'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { isNotFound } from '@/lib/api'
import { formatArea, formatPrice, PROPERTY_TYPE_LABELS, PURPOSE_LABELS } from '@/lib/format'
import { whatsappLink } from '@/lib/whatsapp'
import type { ListingDetail } from '@/types/api'

function BackLink() {
  return (
    <Button variant="ghost" className="self-start" nativeButton={false} render={<Link to="/listings" />}>
      <ArrowLeft data-icon="inline-start" /> All listings
    </Button>
  )
}

function ContactCard({ listing }: { listing: ListingDetail }) {
  const { data: profile } = useProfile()
  if (!profile) return null

  const message = `Hi ${profile.name}, I'm interested in "${listing.title}" (${window.location.origin}/listings/${listing.slug}).`
  const whatsapp = whatsappLink(profile.whatsapp_number, message)
  if (!whatsapp && !profile.contact.phone) return null

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <p className="font-medium">Interested in this property?</p>
        <p className="text-sm text-muted-foreground">Contact {profile.name} directly.</p>
        {whatsapp && (
          <Button
            className="w-full bg-[#25D366] text-white hover:bg-[#1ebe5b]"
            nativeButton={false}
            render={<a href={whatsapp} target="_blank" rel="noopener noreferrer" />}
          >
            <MessageCircle data-icon="inline-start" /> Chat on WhatsApp
          </Button>
        )}
        {profile.contact.phone && (
          <Button variant="outline" className="w-full" nativeButton={false} render={<a href={`tel:${profile.contact.phone}`} />}>
            <Phone data-icon="inline-start" /> {profile.contact.phone}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function Spec({ icon: Icon, label, value }: { icon: typeof BedDouble; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-5 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  )
}

export function ListingDetailPage() {
  const { slug = '' } = useParams()
  const { data: listing, isPending, error } = useListing(slug)
  const market = useMarket()

  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="aspect-[16/9] w-full rounded-xl" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-5 w-1/3" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        {isNotFound(error) ? (
          <EmptyState
            title="Listing not found"
            description="This property may have been sold, rented or removed."
            action={
              <Button variant="outline" nativeButton={false} render={<Link to="/listings" />}>
                Browse listings
              </Button>
            }
          />
        ) : (
          <Alert variant="destructive">
            <AlertTitle>Couldn't load this listing</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  const place = [listing.locality, listing.city].filter(Boolean).join(', ')

  return (
    <div className="flex flex-col gap-6">
      <title>{`${listing.title} | BrickBot`}</title>
      <BackLink />
      <ListingGallery media={listing.media} title={listing.title} />

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Badge>{PURPOSE_LABELS[listing.purpose]}</Badge>
              <Badge variant="secondary">{PROPERTY_TYPE_LABELS[listing.property_type]}</Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{listing.title}</h1>
            {place && (
              <p className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="size-4" /> {place}
              </p>
            )}
            <p className="text-2xl font-semibold">{formatPrice(listing.price, listing.purpose, market)}</p>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Spec icon={Building2} label="Type" value={PROPERTY_TYPE_LABELS[listing.property_type]} />
            {listing.bedrooms !== null && <Spec icon={BedDouble} label="Bedrooms" value={String(listing.bedrooms)} />}
            {listing.bathrooms !== null && <Spec icon={Bath} label="Bathrooms" value={String(listing.bathrooms)} />}
            {listing.area !== null && <Spec icon={Ruler} label="Area" value={formatArea(listing.area, market)} />}
          </div>

          {(listing.description || listing.address) && <Separator />}

          {listing.description && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">About this property</h2>
              <p className="whitespace-pre-line text-muted-foreground">{listing.description}</p>
            </section>
          )}
          {listing.address && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">Address</h2>
              <p className="text-muted-foreground">{listing.address}</p>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
          <ContactCard listing={listing} />
          <Card>
            <CardContent className="flex flex-col gap-4">
              <p className="font-medium">Send an inquiry</p>
              <InquiryForm listingSlug={listing.slug} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
