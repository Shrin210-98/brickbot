import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { ListingSummary } from '@/types/api'
import { ListingCard } from './ListingCard'

interface ListingGridProps {
  items: ListingSummary[] | undefined
  isLoading: boolean
  skeletonCount?: number
  empty: ReactNode
}

export function ListingGrid({ items, isLoading, skeletonCount = 6, empty }: ListingGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: skeletonCount }, (_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="aspect-[4/3] w-full rounded-xl" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    )
  }
  if (!items?.length) return <>{empty}</>
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  )
}
