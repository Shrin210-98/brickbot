import { useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { useMarket } from '@/api/profile'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { formatPriceCompact } from '@/lib/format'
import { PRICE_STEPS, positionsToQuery, positionToPrice, priceToPosition, type PriceBounds } from '@/lib/price-range'
import { cn } from '@/lib/utils'
import type { ListingQuery } from '@/types/api'

type PriceQuery = Pick<ListingQuery, 'min_price' | 'max_price'>

// "₹50L – ₹3Cr", "₹50L+", "Up to ₹3Cr", or null when there's no limit.
function rangeLabel({ min_price, max_price }: PriceQuery, fmt: (n: number) => string): string | null {
  if (min_price !== undefined && max_price !== undefined) return `${fmt(min_price)} – ${fmt(max_price)}`
  if (min_price !== undefined) return `${fmt(min_price)}+`
  if (max_price !== undefined) return `Up to ${fmt(max_price)}`
  return null
}

// The dual-thumb slider. It applies on release (onValueCommitted), not while
// dragging, so the list refetches once per adjustment.
function PriceRangePanel({
  price,
  bounds,
  onChange,
}: {
  price: PriceQuery
  bounds: PriceBounds
  onChange: (price: PriceQuery) => void
}) {
  const market = useMarket()
  const fmt = (n: number) => formatPriceCompact(n, market)
  const fromQuery: [number, number] = [
    price.min_price === undefined ? 0 : priceToPosition(price.min_price, bounds),
    price.max_price === undefined ? PRICE_STEPS : priceToPosition(price.max_price, bounds),
  ]
  const [pos, setPos] = useState(fromQuery)
  // Follow the URL (a commit, Clear filters, a new purpose's bounds) without
  // remounting, so a thumb keeps keyboard focus between steps.
  const [synced, setSynced] = useState(fromQuery.join())
  if (fromQuery.join() !== synced) {
    setSynced(fromQuery.join())
    setPos(fromQuery)
  }
  const live = positionsToQuery(pos, bounds)

  return (
    <div className="flex flex-col gap-4 p-1">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium" aria-live="polite">
          {rangeLabel(live, fmt) ?? 'Any'}
        </p>
        {(live.min_price !== undefined || live.max_price !== undefined) && (
          <button
            type="button"
            className="text-sm text-primary underline-offset-4 hover:underline"
            onClick={() => {
              setPos([0, PRICE_STEPS])
              onChange({ min_price: undefined, max_price: undefined })
            }}
          >
            Any price
          </button>
        )}
      </div>
      <Slider
        aria-label="Price range"
        min={0}
        max={PRICE_STEPS}
        step={1}
        minStepsBetweenValues={1}
        value={pos}
        onValueChange={(v) => setPos(v as [number, number])}
        onValueCommitted={(v) => onChange(positionsToQuery(v as [number, number], bounds))}
        className="py-2"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{fmt(positionToPrice(0, bounds))}</span>
        <span>{fmt(positionToPrice(PRICE_STEPS, bounds))}</span>
      </div>
    </div>
  )
}

// The price segment: a button opening a popover slider in the filter bar,
// or the slider inline (inside the mobile Sheet). Bounds come from the facets;
// without them there is nothing to slide.
export function PriceFilter({
  price,
  bounds,
  onChange,
  inline = false,
  className,
}: {
  price: PriceQuery
  bounds: PriceBounds | null
  onChange: (price: PriceQuery) => void
  inline?: boolean
  className?: string
}) {
  const market = useMarket()
  const label = rangeLabel(price, (n) => formatPriceCompact(n, market))

  if (inline) {
    return bounds ? (
      <PriceRangePanel price={price} bounds={bounds} onChange={onChange} />
    ) : (
      <p className="text-sm text-muted-foreground">No prices to filter by yet.</p>
    )
  }

  return (
    <Popover>
      <PopoverTrigger
        disabled={!bounds}
        aria-label={label ? `Price range: ${label}` : 'Price range'}
        className={cn('flex items-center justify-between gap-2 text-left disabled:opacity-50', className)}
      >
        <span className={cn('truncate', !label && 'text-muted-foreground')}>{label ?? 'Price range'}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      {bounds && (
        <PopoverContent align="end" className="w-80 p-4">
          <PriceRangePanel price={price} bounds={bounds} onChange={onChange} />
        </PopoverContent>
      )}
    </Popover>
  )
}
