import { z } from 'zod'
import { LISTING_STATUSES } from '@/lib/admin-query'
import type { ListingDetail, ListingWrite, PropertyType, Purpose } from '@/types/api'

// Mirrors the backend's slugRE (backend/internal/httpx/validate.go).
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DIGITS_RE = /^\d+$/

export const PURPOSES = ['sale', 'rent'] as const satisfies readonly Purpose[]
export const PROPERTY_TYPES = [
  'apartment',
  'house',
  'villa',
  'plot',
  'commercial',
  'other',
] as const satisfies readonly PropertyType[]

// Number inputs are kept as strings in the form so "" can mean "not set";
// the schema turns them into number | null.
function optionalInt(label: string, min: number, max: number) {
  return z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (DIGITS_RE.test(v) && Number(v) >= min && Number(v) <= max),
      `${label} must be a whole number from ${min} to ${max}`,
    )
    .transform((v) => (v === '' ? null : Number(v)))
}

// Mirrors the POST/PUT /api/admin/listings validator tags.
export const listingSchema = z.object({
  slug: z
    .string()
    .trim()
    .max(120, 'Slug must be at most 120 characters')
    .refine((v) => v === '' || SLUG_RE.test(v), 'Use lowercase letters and digits separated by single hyphens')
    .transform((v) => v || undefined),
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),
  description: z.string().trim().max(10000, 'Description must be at most 10000 characters'),
  purpose: z.enum(PURPOSES),
  property_type: z.enum(PROPERTY_TYPES),
  status: z.enum(LISTING_STATUSES),
  price: z
    .string()
    .trim()
    .min(1, { message: 'Price is required', abort: true })
    .refine((v) => DIGITS_RE.test(v) && Number.isSafeInteger(Number(v)), 'Price must be a whole number')
    .transform(Number),
  bedrooms: optionalInt('Bedrooms', 0, 50),
  bathrooms: optionalInt('Bathrooms', 0, 50),
  // area is an int32 on the backend.
  area: optionalInt('Area', 1, 2_147_483_647),
  city: z.string().trim().min(1, 'City is required').max(100, 'City must be at most 100 characters'),
  locality: z.string().trim().max(100, 'Locality must be at most 100 characters'),
  address: z.string().trim().max(300, 'Address must be at most 300 characters'),
  featured: z.boolean(),
}) satisfies z.ZodType<ListingWrite, unknown>

export type ListingInput = z.input<typeof listingSchema>
export type ListingValues = z.output<typeof listingSchema>

export const LISTING_FIELDS = Object.keys(listingSchema.shape) as (keyof ListingInput)[]

const intToInput = (n: number | null) => (n === null ? '' : String(n))

// Form values for a new listing, or for editing an existing one.
export function listingToInput(listing?: ListingDetail): ListingInput {
  if (!listing) {
    return {
      slug: '',
      title: '',
      description: '',
      purpose: 'sale',
      property_type: 'apartment',
      status: 'draft',
      price: '',
      bedrooms: '',
      bathrooms: '',
      area: '',
      city: '',
      locality: '',
      address: '',
      featured: false,
    }
  }
  return {
    slug: listing.slug,
    title: listing.title,
    description: listing.description,
    purpose: listing.purpose,
    property_type: listing.property_type,
    status: listing.status,
    price: String(listing.price),
    bedrooms: intToInput(listing.bedrooms),
    bathrooms: intToInput(listing.bathrooms),
    area: intToInput(listing.area),
    city: listing.city,
    locality: listing.locality,
    address: listing.address,
    featured: listing.featured,
  }
}
