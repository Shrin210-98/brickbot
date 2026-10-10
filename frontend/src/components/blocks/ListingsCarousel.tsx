import { ListingCard } from '@/components/listings/ListingCard'
import type { ListingSummary } from '@/types/api'
import { Carousel } from './Carousel'

// Carousel defaults give basis-[85%] sm:basis-[48%] lg:basis-[32%].
export function ListingsCarousel({ items }: { items: ListingSummary[] }) {
  const cards = items.map((listing, i) => <ListingCard key={listing.id} listing={listing} index={i} />)
  if (items.length < 2) {
    return <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{cards}</div>
  }
  return <Carousel label="Featured listings" items={cards} />
}
