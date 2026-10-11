import { useState, type ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { LISTINGS_PAGE_SIZE, useListings } from '@/api/listings'
import { EmptyState } from '@/components/listings/EmptyState'
import { ListingFilters } from '@/components/listings/ListingFilters'
import { ListingGrid } from '@/components/listings/ListingGrid'
import { ListingPagination } from '@/components/listings/ListingPagination'
import { OfflineNotice } from '@/components/OfflineNotice'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { isOffline } from '@/lib/api'
import { hasActiveFilters, parseListingQuery, toSearchParams } from '@/lib/listing-filters'
import type { ListingQuery, ListingSort } from '@/types/api'

const SORT_ITEMS: { value: ListingSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
]

// Phones get the filter form in a bottom sheet, so the results start near the top.
function FiltersSheet({ active, total, children }: { active: boolean; total: number | undefined; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" className="h-11 self-start" />}>
        <SlidersHorizontal data-icon="inline-start" /> Filters
        {active && <Badge className="ml-1">On</Badge>}
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">Filter listings</SheetTitle>
        </SheetHeader>
        <div className="px-4">{children}</div>
        <SheetFooter className="sticky bottom-0 border-t bg-popover pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button className="h-11 text-base" onClick={() => setOpen(false)}>
            {total === undefined ? 'Show results' : `Show ${total} ${total === 1 ? 'property' : 'properties'}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function ListingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = parseListingQuery(searchParams)
  const listings = useListings(query)

  const setQuery = (next: ListingQuery) => setSearchParams(toSearchParams(next))
  const hrefFor = (page: number) => {
    const params = toSearchParams({ ...query, page })
    return params.size ? `?${params}` : '?'
  }
  const goToPage = (page: number) => {
    setQuery({ ...query, page })
    window.scrollTo({ top: 0 })
  }

  const total = listings.data?.total ?? 0
  const pageCount = Math.ceil(total / LISTINGS_PAGE_SIZE)
  const filtered = hasActiveFilters(query)
  const wide = useMediaQuery('(min-width: 48rem)') // Tailwind md
  const filters = <ListingFilters key={searchParams.toString()} query={query} onChange={setQuery} />

  return (
    <div className="flex flex-col gap-6">
      <title>Listings | BrickBot</title>
      <h1 className="text-3xl font-bold tracking-tight">Listings</h1>

      {wide ? filters : <FiltersSheet active={filtered} total={listings.data?.total}>{filters}</FiltersSheet>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {listings.isPending ? 'Loading…' : `${total} ${total === 1 ? 'property' : 'properties'}`}
        </p>
        <Select
          items={SORT_ITEMS}
          value={query.sort ?? 'newest'}
          onValueChange={(v) => setQuery({ ...query, sort: v === 'newest' ? undefined : (v as ListingSort), page: 1 })}
        >
          <SelectTrigger aria-label="Sort by" className="w-48 data-[size=default]:h-11 md:data-[size=default]:h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_ITEMS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {listings.isError && isOffline(listings.error) ? (
        <OfflineNotice />
      ) : listings.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load listings</AlertTitle>
          <AlertDescription>{listings.error.message}</AlertDescription>
        </Alert>
      ) : (
        <ListingGrid
          items={listings.data?.items}
          isLoading={listings.isPending}
          empty={
            filtered ? (
              <EmptyState
                title="No listings match your filters"
                description="Try widening your search or clearing the filters."
                action={
                  <Button variant="outline" onClick={() => setSearchParams(new URLSearchParams())}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState title="No listings yet" description="New properties will appear here as soon as they're published." />
            )
          }
        />
      )}

      <ListingPagination page={query.page} pageCount={pageCount} hrefFor={hrefFor} onPageChange={goToPage} />
    </div>
  )
}
