import type { ListingFacets, Purpose } from '@/types/api'

// The price slider runs on a log scale: sale prices (crores) and rents
// (thousands) differ by ~1000×, and a linear track would crush the low end.
export const PRICE_STEPS = 100

export interface PriceBounds {
  min: number
  max: number
}

// Slider bounds from the facets: the chosen purpose's range, or the range
// across all purposes. null when there is nothing to range over.
export function priceBounds(facets: ListingFacets | undefined, purpose: Purpose | undefined): PriceBounds | null {
  const rows = (facets?.purposes ?? []).filter((p) => p.count > 0 && (!purpose || p.value === purpose))
  if (rows.length === 0) return null
  const min = Math.max(1, Math.min(...rows.map((r) => r.min_price)))
  const max = Math.max(...rows.map((r) => r.max_price))
  return max > min ? { min, max } : null
}

// Two significant figures: 18,734,000 → 19,000,000. Keeps labels short.
function roundNice(n: number): number {
  if (n <= 0) return 0
  const unit = 10 ** (Math.floor(Math.log10(n)) - 1)
  return Math.round(n / unit) * unit
}

// Slider position (0..PRICE_STEPS) to a price. The ends are the exact bounds.
export function positionToPrice(pos: number, b: PriceBounds): number {
  if (pos <= 0) return b.min
  if (pos >= PRICE_STEPS) return b.max
  return roundNice(b.min * (b.max / b.min) ** (pos / PRICE_STEPS))
}

// A price to the nearest slider position, clamped to the track.
export function priceToPosition(price: number, b: PriceBounds): number {
  if (price <= b.min) return 0
  if (price >= b.max) return PRICE_STEPS
  return Math.round((Math.log(price / b.min) / Math.log(b.max / b.min)) * PRICE_STEPS)
}

// Slider positions to query values: a thumb resting on its end means "no limit".
export function positionsToQuery([lo, hi]: [number, number], b: PriceBounds) {
  return {
    min_price: lo <= 0 ? undefined : positionToPrice(lo, b),
    max_price: hi >= PRICE_STEPS ? undefined : positionToPrice(hi, b),
  }
}
