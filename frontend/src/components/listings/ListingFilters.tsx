import { useState, type ReactNode } from 'react'
import { useListingFacets } from '@/api/listings'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { hasActiveFilters } from '@/lib/listing-filters'
import { PROPERTY_TYPE_LABELS, PURPOSE_LABELS } from '@/lib/format'
import { priceBounds } from '@/lib/price-range'
import { cn } from '@/lib/utils'
import type { ListingQuery, PropertyType, Purpose } from '@/types/api'
import { PriceFilter } from './PriceFilter'

const ANY = 'any'

// 'bar': the lg+ two-line joined-segment bar. 'stack': one field per row with
// visible labels, inside the mobile filter Sheet. Both are square.
export type FilterLayout = 'bar' | 'stack'

interface Option {
  value: string
  label: string
}

// Square control styles. In the bar, segments are borderless (their wrapper
// draws the divider) and show focus as an inset terracotta ring.
const CONTROL = {
  bar: 'h-10 w-full min-w-0 rounded-none border-0 bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
  stack:
    'h-11 w-full min-w-0 rounded-none border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
}
// SelectTrigger sets its height and focus ring through data/state variants, so
// those are overridden at the same specificity.
const TRIGGER = {
  bar: 'data-[size=default]:h-10 focus-visible:border-transparent',
  stack: 'data-[size=default]:h-11',
}

function FilterField({ id, label, layout, children }: { id: string; label: string; layout: FilterLayout; children: ReactNode }) {
  if (layout === 'bar') return <div className="min-w-0">{children}</div>
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </label>
      {children}
    </div>
  )
}

function FilterSelect({
  id,
  label,
  value,
  options,
  layout,
  onChange,
}: {
  id: string
  label: string
  value: string | undefined
  options: Option[]
  layout: FilterLayout
  onChange: (value: string | undefined) => void
}) {
  const items = [{ value: ANY, label: 'Any' }, ...options]
  const labelOf = (v: string) => items.find((i) => i.value === v)?.label ?? v
  return (
    <FilterField id={id} label={label} layout={layout}>
      <Select
        items={items}
        value={value ?? ANY}
        onValueChange={(v) => onChange(v === ANY || v === null ? undefined : String(v))}
      >
        <SelectTrigger id={id} aria-label={layout === 'bar' ? label : undefined} className={cn(CONTROL[layout], TRIGGER[layout])}>
          {/* In the bar an unset select shows its name, like a placeholder. */}
          <SelectValue>
            {(v: string) =>
              v === ANY ? <span className="text-muted-foreground">{layout === 'bar' ? label : 'Any'}</span> : labelOf(v)
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {items.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  )
}

// Its own small form: applies on Enter. Keyed on the URL's q by the caller, so
// it resets when the search changes elsewhere (Clear filters, back button).
function SearchField({ initial, layout, onSearch }: { initial: string; layout: FilterLayout; onSearch: (q: string | undefined) => void }) {
  const [q, setQ] = useState(initial)
  return (
    <form
      role="search"
      className="min-w-0"
      onSubmit={(e) => {
        e.preventDefault()
        onSearch(q.trim() || undefined)
      }}
    >
      <FilterField id="filter-q" label="Search" layout={layout}>
        <input
          id="filter-q"
          type="search"
          enterKeyHint="search"
          value={q}
          maxLength={100}
          placeholder="Search…"
          aria-label={layout === 'bar' ? 'Search listings' : undefined}
          onChange={(e) => setQ(e.target.value)}
          className={cn(CONTROL[layout], 'placeholder:text-muted-foreground')}
        />
      </FilterField>
    </form>
  )
}

interface ListingFiltersProps {
  query: ListingQuery
  onChange: (query: ListingQuery) => void
  layout: FilterLayout
}

// Selects and the price slider apply immediately; search applies on Enter.
// Not remounted on URL changes, so an open price popover stays open while it
// applies; each control follows the query on its own.
export function ListingFilters({ query, onChange, layout }: ListingFiltersProps) {
  const { data: facets } = useListingFacets()

  const update = (patch: Partial<ListingQuery>) => onChange({ ...query, ...patch, page: 1 })

  const purposeOptions = (Object.keys(PURPOSE_LABELS) as Purpose[]).map((p) => ({ value: p, label: PURPOSE_LABELS[p] }))
  const typeOptions = (Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[]).map((t) => ({
    value: t,
    label: PROPERTY_TYPE_LABELS[t],
  }))
  const cityOptions = (facets?.cities ?? []).map((c) => ({ value: c.value, label: `${c.value} (${c.count})` }))
  if (query.city && !cityOptions.some((c) => c.value === query.city)) {
    cityOptions.push({ value: query.city, label: query.city })
  }
  // Localities of the chosen city, or of every city.
  const localityOptions = (facets?.localities ?? [])
    .filter((l) => !query.city || l.city === query.city)
    .map((l) => ({ value: l.value, label: `${l.value} (${l.count})` }))
  if (query.locality && !localityOptions.some((l) => l.value === query.locality)) {
    localityOptions.push({ value: query.locality, label: query.locality })
  }
  const bedOptions = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}+` }))

  const search = <SearchField key={query.q ?? ''} initial={query.q ?? ''} layout={layout} onSearch={(q) => update({ q })} />
  const purpose = (
    <FilterSelect
      id="filter-purpose"
      label="Purpose"
      layout={layout}
      value={query.purpose}
      options={purposeOptions}
      onChange={(v) => update({ purpose: v as Purpose | undefined })}
    />
  )
  const beds = (
    <FilterSelect
      id="filter-beds"
      label="Bedrooms"
      layout={layout}
      value={query.beds?.toString()}
      options={bedOptions}
      onChange={(v) => update({ beds: v === undefined ? undefined : Number(v) })}
    />
  )
  const type = (
    <FilterSelect
      id="filter-type"
      label="Type"
      layout={layout}
      value={query.type}
      options={typeOptions}
      onChange={(v) => update({ type: v as PropertyType | undefined })}
    />
  )
  const city = (
    <FilterSelect
      id="filter-city"
      label="City"
      layout={layout}
      value={query.city}
      options={cityOptions}
      onChange={(v) => update({ city: v, locality: undefined })}
    />
  )
  const locality = (
    <FilterSelect
      id="filter-locality"
      label="Locality"
      layout={layout}
      value={query.locality}
      options={localityOptions}
      onChange={(v) => update({ locality: v })}
    />
  )
  const priceProps = {
    price: { min_price: query.min_price, max_price: query.max_price },
    bounds: priceBounds(facets, query.purpose),
    onChange: update,
  }
  const clear = hasActiveFilters(query) && (
    <button
      type="button"
      className="min-h-11 self-end text-sm text-primary underline-offset-4 hover:underline lg:min-h-0"
      onClick={() => onChange({ page: 1, sort: query.sort })}
    >
      Clear filters
    </button>
  )

  if (layout === 'stack') {
    return (
      <div className="flex flex-col gap-4">
        {search}
        {purpose}
        {beds}
        {type}
        {city}
        {locality}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Price range</p>
          <PriceFilter {...priceProps} inline />
        </div>
        {clear}
      </div>
    )
  }

  // Each line is one bordered strip; wrappers after the first draw a 1px divider.
  const line = 'grid border border-input bg-background [&>*+*]:border-l [&>*+*]:border-input'
  return (
    <div className="flex flex-col gap-2">
      <div className={cn(line, 'grid-cols-[2fr_1fr_1fr]')}>
        {search}
        {purpose}
        {beds}
      </div>
      <div className={cn(line, 'grid-cols-4')}>
        {type}
        {city}
        {locality}
        <div className="min-w-0">
          <PriceFilter {...priceProps} className={CONTROL.bar} />
        </div>
      </div>
      {clear}
    </div>
  )
}
