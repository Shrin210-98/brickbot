import { describe, expect, it } from 'vitest'
import type { ListingDetail } from '@/types/api'
import { listingSchema, listingToInput, type ListingInput } from './listing-schema'

const valid: ListingInput = {
  ...listingToInput(),
  title: '2 BHK in Andheri West',
  price: '18500000',
  city: 'Mumbai',
}

function issuePaths(input: ListingInput): string[] {
  const res = listingSchema.safeParse(input)
  return res.success ? [] : res.error.issues.map((i) => i.path.join('.'))
}

describe('listingSchema', () => {
  it('turns form strings into the API body', () => {
    expect(listingSchema.parse({ ...valid, bedrooms: '2', bathrooms: '', area: ' 950 ', locality: ' Andheri ' })).toEqual({
      slug: undefined,
      title: '2 BHK in Andheri West',
      description: '',
      purpose: 'sale',
      property_type: 'apartment',
      status: 'draft',
      price: 18500000,
      bedrooms: 2,
      bathrooms: null,
      area: 950,
      city: 'Mumbai',
      locality: 'Andheri',
      address: '',
      featured: false,
    })
  })

  it('omits an empty slug so the API generates or keeps it', () => {
    expect(listingSchema.parse({ ...valid, slug: '  ' }).slug).toBeUndefined()
    expect(JSON.stringify(listingSchema.parse(valid))).not.toContain('slug')
  })

  it.each([
    ['2bhk-andheri-west', true],
    ['a', true],
    ['2BHK', false],
    ['two--hyphens', false],
    ['-leading', false],
    ['trailing-', false],
    ['has space', false],
    ['a'.repeat(121), false],
  ])('slug %s valid=%s', (slug, ok) => {
    expect(issuePaths({ ...valid, slug }).includes('slug')).toBe(!ok)
  })

  it('requires title, price and city', () => {
    expect(issuePaths({ ...valid, title: ' ', price: '', city: '' }).sort()).toEqual(['city', 'price', 'title'])
  })

  it.each(['-1', '1.5', '1e6', 'abc', '9007199254740993'])('rejects price %s', (price) => {
    expect(issuePaths({ ...valid, price })).toEqual(['price'])
  })

  it('accepts a zero price', () => {
    expect(listingSchema.parse({ ...valid, price: '0' }).price).toBe(0)
  })

  it('bounds bedrooms, bathrooms and area like the backend', () => {
    expect(issuePaths({ ...valid, bedrooms: '0', bathrooms: '50', area: '1' })).toEqual([])
    expect(issuePaths({ ...valid, bedrooms: '51' })).toEqual(['bedrooms'])
    expect(issuePaths({ ...valid, bathrooms: '-1' })).toEqual(['bathrooms'])
    expect(issuePaths({ ...valid, area: '0' })).toEqual(['area'])
    expect(issuePaths({ ...valid, area: '2147483648' })).toEqual(['area'])
  })

  it('enforces max lengths', () => {
    expect(issuePaths({ ...valid, title: 'a'.repeat(201) })).toEqual(['title'])
    expect(issuePaths({ ...valid, description: 'a'.repeat(10001) })).toEqual(['description'])
    expect(issuePaths({ ...valid, address: 'a'.repeat(301) })).toEqual(['address'])
    expect(issuePaths({ ...valid, locality: 'a'.repeat(101) })).toEqual(['locality'])
  })
})

describe('listingToInput', () => {
  it('round-trips an existing listing, nulls included', () => {
    const listing: ListingDetail = {
      id: '1',
      slug: 'villa-goa',
      title: 'Villa in Goa',
      description: 'Sea view',
      purpose: 'rent',
      property_type: 'villa',
      status: 'active',
      price: 250000,
      bedrooms: 4,
      bathrooms: null,
      area: null,
      city: 'Goa',
      locality: '',
      address: '',
      featured: true,
      cover_url: null,
      media: [],
      created_at: '',
      updated_at: '',
    }
    const input = listingToInput(listing)
    expect(input).toMatchObject({ price: '250000', bedrooms: '4', bathrooms: '', area: '' })
    expect(listingSchema.parse(input)).toMatchObject({
      slug: 'villa-goa',
      price: 250000,
      bedrooms: 4,
      bathrooms: null,
      area: null,
      featured: true,
    })
  })
})
