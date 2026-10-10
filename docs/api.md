# BrickBot HTTP API

Base path: `/api`. JSON in and out, `snake_case` field names. Updated whenever a route is added, changed or removed.

## Conventions

**Error envelope** (every non-2xx response):

```json
{"error": {"code": "validation_failed", "message": "Request validation failed", "fields": {"email": "must be a valid email"}}}
```

| Status | `code` | When |
|---|---|---|
| 400 | `bad_request` | Malformed JSON / query params |
| 401 | `unauthorized` | Missing or invalid admin cookie |
| 404 | `not_found` | Resource does not exist (or is not public) |
| 409 | `conflict` | Unique violation, concurrent chat stream |
| 413 | `payload_too_large` | Body / upload over limit |
| 422 | `validation_failed` | Struct validation failed; see `fields` |
| 429 | `rate_limited` | Rate limit exceeded |
| 500 | `internal` | Unexpected server error |
| 503 | `unavailable` | Chatbot disabled (no API key) |

**Pagination:** `?page=1&page_size=20` → `{"items": [...], "total": 0, "page": 1, "page_size": 20}`.

## Public

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/healthz` | — | Liveness |
| GET | `/api/profile` | — | Salesman profile |
| GET | `/api/listings` | — | Paginated, filtered catalog |
| GET | `/api/listings/featured` | — | Up to 6 featured listings |
| GET | `/api/listings/facets` | — | Filter options with counts |
| GET | `/api/listings/{slug}` | — | One listing with media |

Public routes only ever expose listings with `status = 'active'`. Media and photo URLs are `/media/<path>`.

### `GET /api/healthz`
Liveness. `200 {"status":"ok"}`. Static response; the API refuses to start if the initial DB ping fails.

### `GET /api/profile`
`200`:
```json
{
  "name": "Ravi Kumar",
  "bio": "Residential and commercial property in western Mumbai.",
  "photo_url": "/media/profile/ravi.jpg",
  "whatsapp_number": "919876543210",
  "service_areas": ["Andheri West", "Bandra"],
  "contact": {"phone": "+919876543210", "email": "ravi@example.com"},
  "country_code": "IN",
  "currency": "INR",
  "area_unit": "sqft"
}
```
`photo_url` may be `null`. `whatsapp_number` is digits only, ready for `https://wa.me/<whatsapp_number>`, and may be `""`. `404 not_found` until the profile is seeded.

### `GET /api/listings`
| Param | Type | Notes |
|---|---|---|
| `purpose` | `sale` \| `rent` | |
| `type` | `apartment` \| `house` \| `villa` \| `plot` \| `commercial` \| `other` | Property type |
| `city` | string ≤100 | Exact, case-insensitive |
| `locality` | string ≤100 | Exact, case-insensitive |
| `min_price`, `max_price` | integer ≥0 | Inclusive. `min_price > max_price` → `400 bad_request` |
| `beds` | integer 0–50 | Minimum bedrooms |
| `q` | string ≤100 | Substring match (case-insensitive) on title, description, city, locality |
| `sort` | `newest` (default) \| `price_asc` \| `price_desc` | Ties: newest first |
| `page` | integer 1–10000 | Default 1 |
| `page_size` | integer 1–100 | Default 20 |

A non-integer value for an integer param → `400 bad_request` with `fields`. An out-of-range or unknown enum value → `422 validation_failed` with `fields`.

`200`: paginated envelope of listing summaries:
```json
{
  "items": [{
    "id": "7f9c…", "slug": "2bhk-andheri-west", "title": "2 BHK in Andheri West",
    "purpose": "sale", "property_type": "apartment", "status": "active",
    "price": 18500000, "bedrooms": 2, "bathrooms": 2, "area": 950,
    "city": "Mumbai", "locality": "Andheri West", "featured": true,
    "cover_url": "/media/listings/7f9c/1.jpg", "created_at": "2026-10-10T08:00:00Z"
  }],
  "total": 1, "page": 1, "page_size": 20
}
```
`bedrooms`, `bathrooms`, `area` and `cover_url` may be `null`. `cover_url` is the first image by position. `price` is in whole units of the profile `currency` (per month for `rent`); `area` is in the profile `area_unit`.

### `GET /api/listings/featured`
`200 {"items": [<listing summary>, …]}`: at most 6 active listings with `featured = true`, newest first. No pagination.

### `GET /api/listings/facets`
Counts over active listings, for building filter UIs. Every array may be empty.
```json
{
  "purposes": [{"value": "sale", "count": 12, "min_price": 4500000, "max_price": 52000000}],
  "property_types": [{"value": "apartment", "count": 9}],
  "cities": [{"value": "Mumbai", "count": 14}],
  "localities": [{"city": "Mumbai", "value": "Andheri West", "count": 5}],
  "bedrooms": [{"value": 2, "count": 6}]
}
```
`localities` leaves out listings with an empty locality. `bedrooms` leaves out listings with no bedroom count.

### `GET /api/listings/{slug}`
`200`: a listing summary plus:
```json
{
  "...": "all listing summary fields",
  "description": "Sunny corner flat…",
  "address": "Lokhandwala Complex, Andheri West",
  "media": [{"id": "…", "url": "/media/listings/7f9c/1.jpg", "media_type": "image", "position": 0}],
  "updated_at": "2026-10-10T08:00:00Z"
}
```
`404 not_found` if no active listing has that slug.

## Data layer

Schema: `backend/db/schema.sql`. Queries: `backend/db/queries/` → `backend/internal/db` (sqlc).

| Table | Queries |
|---|---|
| `salesman_profile` (singleton, `id = 1`) | `GetProfile`, `CreateProfileIfMissing` (seed), `UpdateProfile`, `UpdateAdminPasswordHash` |
| `listings` | Public (`status = 'active'` only): `ListActiveListings`, `CountActiveListings`, `ListFeaturedListings`, `GetActiveListingBySlug`, `FacetPurposes`, `FacetPropertyTypes`, `FacetCities`, `FacetLocalities`, `FacetBedrooms`. Admin: `ListListings`, `CountListings`, `GetListing`, `CreateListing`, `UpdateListing`, `DeleteListing`. Seed: `UpsertListingBySlug` |
| `listing_media` | `ListListingMedia`, `ListMediaForListings` (batch), `CreateListingMedia`, `UpdateListingMediaPosition`, `DeleteListingMedia` |
