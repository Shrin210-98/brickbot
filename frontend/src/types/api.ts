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

export interface Testimonial {
  id: string
  author_name: string
  author_title: string | null
  author_photo_url: string | null
  quote: string
  rating: number | null
  listing_slug: string | null
  created_at: string
}

export interface Testimonials {
  items: Testimonial[]
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

// Admin

export type InquiryStatus = 'new' | 'contacted' | 'closed' | 'spam'
export type InquirySource = 'form' | 'chat'

export interface Inquiry {
  id: string
  listing: { id: string; slug: string; title: string } | null
  name: string
  phone: string
  email: string
  message: string
  source: InquirySource
  status: InquiryStatus
  admin_note: string
  created_at: string
  updated_at: string
}

// PATCH /api/admin/inquiries/{id}: at least one field.
export interface InquiryUpdate {
  status?: InquiryStatus
  admin_note?: string
}

// POST /api/admin/listings and PUT /api/admin/listings/{id}.
// slug omitted → generated (create) or unchanged (update).
export interface ListingWrite {
  slug?: string
  title: string
  description: string
  purpose: Purpose
  property_type: PropertyType
  status: ListingStatus
  price: number
  bedrooms: number | null
  bathrooms: number | null
  area: number | null
  city: string
  locality: string
  address: string
  featured: boolean
}

export interface MediaOrder {
  media_ids: string[]
}

// Query params accepted by the admin list routes.
export interface AdminListQuery<S extends string> {
  status?: S
  page: number
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
