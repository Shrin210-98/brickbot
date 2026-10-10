// Mirrors the backend JSON exactly (docs/api.md). snake_case, never camelCased.

export type Purpose = 'sale' | 'rent'
export type PropertyType = 'apartment' | 'house' | 'villa' | 'plot' | 'commercial' | 'other'
export type ListingStatus = 'draft' | 'active' | 'sold' | 'rented'
export type MediaType = 'image' | 'video'
export type ListingSort = 'newest' | 'price_asc' | 'price_desc'
export type AreaUnit = 'sqft' | 'sqm'

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    fields?: Record<string, string>
  }
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface Profile {
  name: string
  bio: string
  photo_url: string | null
  whatsapp_number: string
  service_areas: string[]
  contact: { phone: string; email: string }
  country_code: string
  currency: string
  area_unit: AreaUnit
}

export interface ListingSummary {
  id: string
  slug: string
  title: string
  purpose: Purpose
  property_type: PropertyType
  status: ListingStatus
  price: number
  bedrooms: number | null
  bathrooms: number | null
  area: number | null
  city: string
  locality: string
  featured: boolean
  cover_url: string | null
  created_at: string
}

export interface ListingMedia {
  id: string
  url: string
  media_type: MediaType
  position: number
}

export interface ListingDetail extends ListingSummary {
  description: string
  address: string
  media: ListingMedia[]
  updated_at: string
}

export interface FeaturedListings {
  items: ListingSummary[]
}

export interface ValueCount<V = string> {
  value: V
  count: number
}

export interface ListingFacets {
  purposes: (ValueCount<Purpose> & { min_price: number; max_price: number })[]
  property_types: ValueCount<PropertyType>[]
  cities: ValueCount[]
  localities: (ValueCount & { city: string })[]
  bedrooms: ValueCount<number>[]
}

// POST /api/inquiries body. Empty strings are allowed; the API trims them.
export interface InquiryCreate {
  name: string
  phone: string
  email: string
  message: string
  listing_slug?: string
}

export interface InquiryCreated {
  id: string
  created_at: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface Me {
  email: string
}

// Query params accepted by GET /api/listings (minus page_size, which the client fixes).
export interface ListingQuery {
  purpose?: Purpose
  type?: PropertyType
  city?: string
  locality?: string
  min_price?: number
  max_price?: number
  beds?: number
  q?: string
  sort?: ListingSort
  page: number
}
