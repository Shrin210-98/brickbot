import { describe, expect, it } from 'vitest'
import { DEFAULT_MARKET, formatPriceCompact } from '@/lib/format'
import { PRICE_STEPS, positionsToQuery, positionToPrice, priceBounds, priceToPosition } from '@/lib/price-range'
import type { ListingFacets } from '@/types/api'

const facets: ListingFacets = {
  purposes: [
    { value: 'rent', count: 5, min_price: 32_000, max_price: 180_000 },
    { value: 'sale', count: 8, min_price: 18_500_000, max_price: 145_000_000 },
  ],
  property_types: [],
  cities: [],
  localities: [],
  bedrooms: [],
}
const sale = { min: 18_500_000, max: 145_000_000 }

describe('priceBounds', () => {
  it('uses the chosen purpose, or the range across all purposes', () => {
    expect(priceBounds(facets, 'sale')).toEqual(sale)
    expect(priceBounds(facets, undefined)).toEqual({ min: 32_000, max: 145_000_000 })
  })
  it('is null with no facets or a single price', () => {
    expect(priceBounds(undefined, undefined)).toBeNull()
    expect(priceBounds({ ...facets, purposes: [{ value: 'sale', count: 1, min_price: 5, max_price: 5 }] }, 'sale')).toBeNull()
  })
})

describe('slider mapping', () => {
  it('hits the exact bounds at both ends', () => {
    expect(positionToPrice(0, sale)).toBe(sale.min)
    expect(positionToPrice(PRICE_STEPS, sale)).toBe(sale.max)
  })
  it('rounds in-between prices to two significant figures and round-trips', () => {
    const price = positionToPrice(50, sale)
    expect(String(price)).toMatch(/^\d{2}0+$/)
    expect(Math.abs(priceToPosition(price, sale) - 50)).toBeLessThanOrEqual(1)
  })
  it('treats thumbs at the ends as no limit', () => {
    expect(positionsToQuery([0, PRICE_STEPS], sale)).toEqual({ min_price: undefined, max_price: undefined })
    expect(positionsToQuery([10, PRICE_STEPS], sale).min_price).toBeGreaterThan(sale.min)
  })
  it('clamps prices outside the bounds', () => {
    expect(priceToPosition(1, sale)).toBe(0)
    expect(priceToPosition(10 ** 12, sale)).toBe(PRICE_STEPS)
  })
})

describe('formatPriceCompact', () => {
  it('uses lakh and crore in India', () => {
    expect(formatPriceCompact(5_000_000, DEFAULT_MARKET)).toBe('₹50L')
    expect(formatPriceCompact(30_000_000, DEFAULT_MARKET)).toBe('₹3Cr')
  })
})
