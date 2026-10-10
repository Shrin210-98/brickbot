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
| 401 | `unauthorized` | Missing or invalid admin cookie; wrong login credentials |
| 403 | `forbidden` | Non-GET request whose `Origin` header is not `APP_ORIGIN` |
| 404 | `not_found` | Resource does not exist (or is not public) |
| 409 | `conflict` | Unique violation, concurrent chat stream |
| 413 | `payload_too_large` | Body / upload over limit |
| 422 | `validation_failed` | Struct validation failed; see `fields` |
| 429 | `rate_limited` | Rate limit exceeded |
| 500 | `internal` | Unexpected server error |
| 503 | `unavailable` | Chatbot disabled (no API key) |

**Pagination:** `?page=1&page_size=20` → `{"items": [...], "total": 0, "page": 1, "page_size": 20}`.

**JSON bodies:** at most 1 MB (`413` above), unknown fields and malformed JSON → `400 bad_request`.

**Ids** in paths are UUIDs. A malformed id → `404 not_found`.

**Origin check:** `POST`/`PUT`/`PATCH`/`DELETE` with an `Origin` header other than `APP_ORIGIN` (default `http://localhost:5173`) → `403 forbidden`. Requests without `Origin` pass.

**Rate limits** (in memory, per client IP; `X-Forwarded-For` last hop only when `TRUST_PROXY=true`): `POST /api/inquiries` 5/min, `POST /api/auth/login` 5 per 15 min, `POST /api/chat/sessions/{id}/messages` 10/min, each with a burst of 5. Over the limit → `429 rate_limited` with `Retry-After` (seconds).

## Public

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/healthz` | — | Liveness |
| GET | `/api/profile` | — | Salesman profile |
| GET | `/api/listings` | — | Paginated, filtered catalog |
| GET | `/api/listings/featured` | — | Up to 6 featured listings |
| GET | `/api/listings/facets` | — | Filter options with counts |
| GET | `/api/listings/{slug}` | — | One listing with media |
| GET | `/api/testimonials` | — | Published client testimonials |
| POST | `/api/inquiries` | — (rate-limited) | Visitor inquiry |
| GET | `/media/{path...}` | — | Uploaded files |

Public routes only ever expose listings with `status = 'active'` that are not soft-deleted. Media and photo URLs are `/media/<path>`.

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
  "area_unit": "sqft",
  "chat_enabled": true
}
```
`chat_enabled` is `false` when `ANTHROPIC_API_KEY` is empty (the SPA then hides the chat launcher). `photo_url` may be `null`. `whatsapp_number` is digits only, ready for `https://wa.me/<whatsapp_number>`, and may be `""`. `404 not_found` until the profile is seeded.

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

### `GET /api/testimonials`
`200`: published testimonials ordered by `position`, then `created_at`. No pagination.
```json
{
  "items": [{
    "id": "3b1e…", "author_name": "Priya & Arjun Mehta", "author_title": "First-time buyers, Bandra West",
    "author_photo_url": null, "quote": "Ravi found us a 2 BHK in our budget in three weeks.",
    "rating": 5, "listing_slug": "2bhk-bandra-west", "created_at": "2026-10-10T08:00:00Z"
  }]
}
```
`author_title`, `author_photo_url`, `rating` (1–5) and `listing_slug` may be `null`. `listing_slug` is set only while the linked listing is active and not deleted. `items` is `[]` when nothing is published.

### `POST /api/inquiries`
```json
{"name": "Asha", "phone": "+91 98765 43210", "email": "asha@example.com", "message": "Is it still available?", "listing_slug": "2bhk-andheri-west"}
```
| Field | Rules |
|---|---|
| `name` | required, ≤100 |
| `phone` | required unless `email`; `+` optional, then 7–20 digits/spaces/`-`/`()` |
| `email` | required unless `phone`; valid email ≤254 |
| `message` | optional, ≤2000 |
| `listing_slug` | optional; must be an active listing, else `404 not_found` |

Strings are trimmed. Neither `phone` nor `email` → `422` with both in `fields`.
`201 {"id": "…", "created_at": "…"}`. Also `400`, `403`, `413`, `429`.

### `GET /media/{path...}`
Serves files from `UPLOAD_DIR`. Directories, hidden files and missing files → `404 not_found` (JSON envelope). `Cache-Control: public, max-age=86400`, `X-Content-Type-Options: nosniff`. Listing images live at `/media/listings/<listing id>/<random uuid>.<jpg|png|webp>`.

## Chat

The visitor chatbot. Design, tools, history rules and the SSE event contract are in `docs/chatbot.md`. Every chat route answers `503 unavailable` while the chatbot is disabled (`ANTHROPIC_API_KEY` empty).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/chat/sessions` | — | Start a conversation |
| GET | `/api/chat/sessions/{id}/messages` | `visitor_id` | Visitor transcript |
| POST | `/api/chat/sessions/{id}/messages` | `visitor_id` (rate-limited) | Send a message; reply streams as SSE |

`visitor_id` is a UUID the browser generates once and keeps. A session belongs to the `visitor_id` that created it; any other or missing `visitor_id`, or an unknown session → `404 not_found`, so a session id reveals nothing.

### `POST /api/chat/sessions`
`{"visitor_id": "…"}` (required, UUID). `201 {"id": "…", "created_at": "…"}`. Also `400`, `403`, `422`, `503`.

### `GET /api/chat/sessions/{id}/messages?visitor_id=…`
`200`:
```json
{"items": [
  {"id": 1, "role": "user", "text": "Any 2 BHK in Bandra?", "created_at": "…"},
  {"id": 4, "role": "assistant", "text": "I found two…", "created_at": "…"}
]}
```
Oldest first. Holds only visitor messages and the assistant's text; tool calls, tool results and listing cards are not replayed. `id`s increase but are not contiguous. Also `404`, `503`.

### `POST /api/chat/sessions/{id}/messages`
`{"visitor_id": "…", "content": "…"}`: `visitor_id` required UUID; `content` required, trimmed, ≤2000.
Before the stream starts, failures are JSON errors: `400`, `403`, `404`, `409` (a reply is already streaming for this session), `413`, `422`, `429`, `503`. Otherwise `200` with `Content-Type: text/event-stream`: events `delta`, `tool`, `listings`, `lead_created`, then exactly one `done` or `error` (contract in `docs/chatbot.md` → SSE contract).

## Auth

One admin, credentials on the profile row (`admin_email`, bcrypt `admin_password_hash`), set by `make seed` from `ADMIN_EMAIL`/`ADMIN_PASSWORD` when the profile is first created.

The session is a stateless cookie `bb_session`: `HttpOnly`, `SameSite=Lax`, `Path=/api`, `Secure` per `COOKIE_SECURE`, valid 7 days (no sliding renewal). It is HMAC-SHA256 signed with `SESSION_SECRET` and bound to a fingerprint of the password hash, so changing the password logs out every session. Logout only clears the cookie in the browser; a copied cookie stays valid until it expires or the password changes.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | — (rate-limited) | Log in, set cookie |
| POST | `/api/auth/logout` | — | Clear cookie |
| GET | `/api/auth/me` | cookie | Current admin |

### `POST /api/auth/login`
`{"email": "…", "password": "…"}` (`email` required + valid, `password` required ≤200). Email compare is case-insensitive.
`204` with `Set-Cookie`. Wrong email or password → `401 unauthorized` (same response for both). Also `400`, `403`, `422`, `429`.

### `POST /api/auth/logout`
`204`, always; expires the cookie.

### `GET /api/auth/me`
`200 {"email": "admin@example.com"}`, or `401`.

## Admin

Everything under `/api/admin/` needs a valid cookie: without one, **every** path there (including unknown ones) → `401 unauthorized`. Soft-deleted listings behave as if they do not exist (`404`).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/listings` | Paginated listings, any status |
| POST | `/api/admin/listings` | Create listing |
| GET | `/api/admin/listings/{id}` | One listing with media |
| PUT | `/api/admin/listings/{id}` | Replace listing fields |
| DELETE | `/api/admin/listings/{id}` | Soft delete |
| POST | `/api/admin/listings/{id}/media` | Upload one image |
| PUT | `/api/admin/listings/{id}/media/{media_id}` | Replace one image's file |
| PATCH | `/api/admin/listings/{id}/media/order` | Reorder images |
| DELETE | `/api/admin/listings/{id}/media/{media_id}` | Delete one image |
| GET | `/api/admin/inquiries` | Paginated inquiries |
| GET | `/api/admin/inquiries/{id}` | One inquiry |
| PATCH | `/api/admin/inquiries/{id}` | Triage inquiry |

### `GET /api/admin/listings`
`?status=draft|active|sold|rented` (optional), `page`, `page_size`. Newest first, soft-deleted excluded.
`200`: paginated envelope of listing summaries (same shape as `GET /api/listings`).

### `POST /api/admin/listings` · `PUT /api/admin/listings/{id}`
```json
{
  "slug": "2bhk-andheri-west", "title": "2 BHK in Andheri West", "description": "…",
  "purpose": "sale", "property_type": "apartment", "status": "draft",
  "price": 18500000, "bedrooms": 2, "bathrooms": 2, "area": 950,
  "city": "Mumbai", "locality": "Andheri West", "address": "…", "featured": false
}
```
| Field | Rules |
|---|---|
| `slug` | optional; `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤120. Create: omitted → generated from `title` (`-2`, `-3`… on collision). Update: omitted → unchanged |
| `title` | required, ≤200 |
| `description` | ≤10000 |
| `purpose` | required, `sale` \| `rent` |
| `property_type` | required, `apartment` \| `house` \| `villa` \| `plot` \| `commercial` \| `other` |
| `status` | `draft` \| `active` \| `sold` \| `rented`. Create: omitted → `draft`. Update: omitted → unchanged |
| `price` | required, integer ≥0 |
| `bedrooms`, `bathrooms` | optional, 0–50, `null` to clear |
| `area` | optional, ≥1, `null` to clear |
| `city` | required, ≤100 |
| `locality` | ≤100 |
| `address` | ≤300 |
| `featured` | boolean, default `false` |

`PUT` replaces every field: omitted optional fields are cleared (except `slug` and `status`, see above).
Create `201`, update `200`: a listing detail (same shape as `GET /api/listings/{slug}`). Slug taken (including by a soft-deleted listing) → `409 conflict`. Also `400`, `404` (update), `422`.

### `GET /api/admin/listings/{id}`
`200`: listing detail, any status. `404` if missing or soft-deleted.

### `DELETE /api/admin/listings/{id}`
Soft delete (`deleted_at` set). The listing disappears from every public and admin route; its slug stays reserved and its media files stay on disk. `204`, or `404`.

### `POST /api/admin/listings/{id}/media`
`multipart/form-data` with one part named `file`: JPEG, PNG or WebP (detected from the bytes, not the name), at most 10 MB. Appended after the existing media.
`201`: `{"id": "…", "url": "/media/listings/…/….png", "media_type": "image", "position": 2}`.
Not multipart or no `file` part → `400`. Too large → `413`. Not an accepted image → `422` with `fields.file`. Unknown listing → `404`.

### `PUT /api/admin/listings/{id}/media/{media_id}`
Same body as upload. Replaces the file behind one media item; `id` and `position` stay, the `url` changes (new file name) and the old file is deleted. `200` media object, or `400`/`404`/`413`/`422`.

### `PATCH /api/admin/listings/{id}/media/order`
`{"media_ids": ["…", "…"]}`: every media id of the listing, exactly once, in the new order (position = index). `204`. Missing, extra, unknown or duplicate ids → `422` with `fields.media_ids`. The first image is the listing's cover.

### `DELETE /api/admin/listings/{id}/media/{media_id}`
Deletes the row and the file. `204`, or `404`.

### `GET /api/admin/inquiries`
`?status=new|contacted|closed|spam` (optional), `page`, `page_size`. Newest first.
`200`: paginated envelope of inquiries:
```json
{
  "id": "…",
  "listing": {"id": "…", "slug": "2bhk-andheri-west", "title": "2 BHK in Andheri West"},
  "name": "Asha", "phone": "+91 98765 43210", "email": "", "message": "…",
  "source": "form", "status": "new", "admin_note": "",
  "created_at": "…", "updated_at": "…"
}
```
`listing` is `null` for a general inquiry. `source` is `form` (inquiry form) or `chat` (recorded by the chatbot after the visitor consented, at most one per chat session).

### `GET /api/admin/inquiries/{id}`
`200` one inquiry, or `404`.

### `PATCH /api/admin/inquiries/{id}`
`{"status": "contacted", "admin_note": "Called back, visit on Sat"}`. At least one field; an omitted field is unchanged. `status` one of `new`, `contacted`, `closed`, `spam`; `admin_note` ≤5000.
`200` updated inquiry. Neither field or invalid values → `422`. Also `404`.

## Data layer

Schema: `backend/db/schema.sql`. Queries: `backend/db/queries/` → `backend/internal/db` (sqlc).

| Table | Queries |
|---|---|
| `salesman_profile` (singleton, `id = 1`) | `GetProfile`, `GetAdminCredentials`, `CreateProfileIfMissing` (seed), `UpdateProfile`, `UpdateAdminPasswordHash` |
| `listings` (soft delete via `deleted_at`; every query filters it) | Public (`status = 'active'` only): `ListActiveListings`, `CountActiveListings`, `ListFeaturedListings`, `GetActiveListingBySlug`, `FacetPurposes`, `FacetPropertyTypes`, `FacetCities`, `FacetLocalities`, `FacetBedrooms`. Admin: `ListListings`, `CountListings`, `GetListing`, `ListingSlugExists`, `CreateListing`, `UpdateListing`, `DeleteListing` (soft). Seed: `UpsertListingBySlug` |
| `listing_media` | `ListListingMedia`, `ListMediaForListings` (batch), `GetListingMedia`, `NextListingMediaPosition`, `CreateListingMedia`, `UpdateListingMediaPath`, `UpdateListingMediaPosition`, `ReorderListingMedia`, `DeleteListingMedia` |
| `inquiries` (`chat_session_id` set for `source = 'chat'`, unique when set) | `CreateInquiry`, `ListInquiries`, `CountInquiries`, `GetInquiry`, `UpdateInquiry` |
| `testimonials` (public only when `is_published`) | `ListPublishedTestimonials`, `GetTestimonialByID` |
| `chat_sessions` | `CreateChatSession`, `GetChatSession` (by id and `visitor_id`) |
| `chat_messages` (append-only; `content` is the raw Anthropic content-block array) | `CreateChatMessage`, `ListRecentChatMessages`, `ListChatMessages` |
