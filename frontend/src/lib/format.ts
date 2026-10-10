import type { AreaUnit, Profile, PropertyType, Purpose } from '@/types/api'

export type Market = Pick<Profile, 'country_code' | 'currency' | 'area_unit'>

// Used until the profile row exists (GET /api/profile → 404).
export const DEFAULT_MARKET: Market = { country_code: 'IN', currency: 'INR', area_unit: 'sqft' }

export const PURPOSE_LABELS: Record<Purpose, string> = { sale: 'For sale', rent: 'For rent' }

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: 'Apartment',
  house: 'House',
  villa: 'Villa',
  plot: 'Plot',
  commercial: 'Commercial',
  other: 'Other',
}

const AREA_UNIT_LABELS: Record<AreaUnit, string> = { sqft: 'sq ft', sqm: 'm²' }

function locale(market: Market): string {
  return `en-${market.country_code}`
}

export function formatPrice(price: number, purpose: Purpose, market: Market): string {
  const amount = new Intl.NumberFormat(locale(market), {
    style: 'currency',
    currency: market.currency,
    maximumFractionDigits: 0,
  }).format(price)
  return purpose === 'rent' ? `${amount}/mo` : amount
}

export function formatArea(area: number, market: Market): string {
  return `${new Intl.NumberFormat(locale(market)).format(area)} ${AREA_UNIT_LABELS[market.area_unit]}`
}
