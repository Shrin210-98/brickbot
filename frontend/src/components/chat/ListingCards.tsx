import { MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMarket } from '@/api/profile'
import { images } from '@/assets/images'
import { formatPrice } from '@/lib/format'
import type { ListingSummary } from '@/types/api'

// Same fallback as ListingCard: placeholders picked by position.
const PLACEHOLDERS = Object.values(images.listings)

// Compact cards for listings a reply returned: a scrolling row on phones, two
// per row from sm up. Following a card calls onNavigate (closes the panel).
export function ListingCards({ listings, onNavigate }: { listings: ListingSummary[]; onNavigate: () => void }) {
  const market = useMarket()

  return (
    <ul className="flex w-full snap-x gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0">
      {listings.map((l, i) => (
        <li key={`${l.id}-${i}`} className="w-40 shrink-0 snap-start sm:w-auto">
          <Link
            to={`/listings/${l.slug}`}
            onClick={onNavigate}
            className="group flex h-full flex-col overflow-hidden rounded-lg border bg-card text-card-foreground transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <img
              src={l.cover_url ?? PLACEHOLDERS[i % PLACEHOLDERS.length]}
              alt=""
              loading="lazy"
              className="aspect-[16/10] w-full bg-muted object-cover"
            />
            <div className="flex flex-col gap-0.5 p-2">
              <p className="text-sm font-semibold">{formatPrice(l.price, l.purpose, market)}</p>
              <p className="line-clamp-2 text-xs font-medium">{l.title}</p>
              {l.locality && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3 shrink-0" aria-hidden />
                  <span className="line-clamp-1">{l.locality}</span>
                </p>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
