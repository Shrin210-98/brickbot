import { Bath, BedDouble, Building2, MapPin, Ruler } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMarket } from '@/api/profile'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatArea, formatPrice, PROPERTY_TYPE_LABELS, PURPOSE_LABELS } from '@/lib/format'
import type { ListingSummary } from '@/types/api'

export function ListingCard({ listing }: { listing: ListingSummary }) {
  const market = useMarket()
  const place = [listing.locality, listing.city].filter(Boolean).join(', ')

  return (
    <Link
      to={`/listings/${listing.slug}`}
      className="group block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow group-hover:shadow-md">
        <div className="relative aspect-[4/3] bg-muted">
          {listing.cover_url ? (
            <img src={listing.cover_url} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <Building2 className="size-10" />
            </div>
          )}
          <Badge className="absolute top-3 left-3">{PURPOSE_LABELS[listing.purpose]}</Badge>
        </div>
        <CardContent className="flex flex-col gap-2 p-4">
          <p className="text-lg font-semibold">{formatPrice(listing.price, listing.purpose, market)}</p>
          <h3 className="line-clamp-1 text-base font-medium">{listing.title}</h3>
          {place && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-4 shrink-0" />
              <span className="line-clamp-1">{place}</span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{PROPERTY_TYPE_LABELS[listing.property_type]}</span>
            {listing.bedrooms !== null && (
              <span className="flex items-center gap-1">
                <BedDouble className="size-4" /> {listing.bedrooms}
              </span>
            )}
            {listing.bathrooms !== null && (
              <span className="flex items-center gap-1">
                <Bath className="size-4" /> {listing.bathrooms}
              </span>
            )}
            {listing.area !== null && (
              <span className="flex items-center gap-1">
                <Ruler className="size-4" /> {formatArea(listing.area, market)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
