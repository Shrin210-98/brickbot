import type { AreaUnit, InquiryStatus, ListingStatus, Profile, PropertyType, Purpose } from '@/types/api'

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

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  sold: 'Sold',
  rented: 'Rented',
}

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  closed: 'Closed',
  spam: 'Spam',
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

// Short form for filter labels: ₹50L, ₹3Cr in India (en-IN compact
// notation), $1.2M elsewhere.
export function formatPriceCompact(price: number, market: Market): string {
  return new Intl.NumberFormat(locale(market), {
    style: 'currency',
    currency: market.currency,
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(price)
}

export function formatArea(area: number, market: Market): string {
  return `${new Intl.NumberFormat(locale(market)).format(area)} ${AREA_UNIT_LABELS[market.area_unit]}`
}

export function formatDateTime(iso: string, market: Market): string {
  return new Intl.DateTimeFormat(locale(market), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

// Indian mobile numbers (+91 and 10 digits) read as "+91 98765 43210"; anything else is shown as stored.
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
  }
  return raw
}
