import { useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'
import { useListingFacets } from '@/api/listings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PROPERTY_TYPE_LABELS, PURPOSE_LABELS } from '@/lib/format'
import type { ListingQuery, PropertyType, Purpose } from '@/types/api'

const ANY = 'any'

interface Option {
  value: string
  label: string
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string | undefined
  options: Option[]
  onChange: (value: string | undefined) => void
}) {
  const items = [{ value: ANY, label: 'Any' }, ...options]
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={items}
        value={value ?? ANY}
        onValueChange={(v) => onChange(v === ANY || v === null ? undefined : String(v))}
      >
        <SelectTrigger id={id} className="w-full data-[size=default]:h-11 md:data-[size=default]:h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function parsePrice(value: string): number | undefined {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits) : undefined
}

interface ListingFiltersProps {
  query: ListingQuery
  onChange: (query: ListingQuery) => void
}

// Selects apply immediately; text fields apply on submit. Remount with a key
// derived from the URL to reset the text fields when the URL changes.
export function ListingFilters({ query, onChange }: ListingFiltersProps) {
  const { data: facets } = useListingFacets()
  const [q, setQ] = useState(query.q ?? '')
  const [minPrice, setMinPrice] = useState(query.min_price?.toString() ?? '')
  const [maxPrice, setMaxPrice] = useState(query.max_price?.toString() ?? '')

  const update = (patch: Partial<ListingQuery>) => onChange({ ...query, ...patch, page: 1 })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    update({ q: q.trim() || undefined, min_price: parsePrice(minPrice), max_price: parsePrice(maxPrice) })
  }

  const purposeOptions = (Object.keys(PURPOSE_LABELS) as Purpose[]).map((p) => ({ value: p, label: PURPOSE_LABELS[p] }))
  const typeOptions = (Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[]).map((t) => ({
    value: t,
    label: PROPERTY_TYPE_LABELS[t],
  }))
  const cityOptions = (facets?.cities ?? []).map((c) => ({ value: c.value, label: `${c.value} (${c.count})` }))
  if (query.city && !cityOptions.some((c) => c.value === query.city)) {
    cityOptions.push({ value: query.city, label: query.city })
  }
  const bedOptions = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}+` }))

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
        <Label htmlFor="filter-q">Search</Label>
        <div className="flex gap-2">
          <Input
            id="filter-q"
            className="h-11 md:h-8"
            value={q}
            maxLength={100}
            placeholder="Title, locality, city…"
            onChange={(e) => setQ(e.target.value)}
          />
          <Button type="submit" className="h-11 md:h-8">
            <Search data-icon="inline-start" /> Search
          </Button>
        </div>
      </div>
      <FilterSelect
        id="filter-purpose"
        label="Purpose"
        value={query.purpose}
        options={purposeOptions}
        onChange={(v) => update({ purpose: v as Purpose | undefined })}
      />
      <FilterSelect
        id="filter-type"
        label="Property type"
        value={query.type}
        options={typeOptions}
        onChange={(v) => update({ type: v as PropertyType | undefined })}
      />
      <FilterSelect
        id="filter-city"
        label="City"
        value={query.city}
        options={cityOptions}
        onChange={(v) => update({ city: v, locality: undefined })}
      />
      <FilterSelect
        id="filter-beds"
        label="Bedrooms"
        value={query.beds?.toString()}
        options={bedOptions}
        onChange={(v) => update({ beds: v === undefined ? undefined : Number(v) })}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter-min-price">Min price</Label>
        <Input
          id="filter-min-price"
          className="h-11 md:h-8"
          inputMode="numeric"
          value={minPrice}
          placeholder="No min"
          onChange={(e) => setMinPrice(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter-max-price">Max price</Label>
        <Input
          id="filter-max-price"
          className="h-11 md:h-8"
          inputMode="numeric"
          value={maxPrice}
          placeholder="No max"
          onChange={(e) => setMaxPrice(e.target.value)}
        />
      </div>
      <div className="flex items-end sm:col-span-2">
        <Button type="submit" variant="outline" className="h-11 w-full sm:w-auto md:h-8">
          Apply price
        </Button>
      </div>
    </form>
  )
}
