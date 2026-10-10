-- ---------- listings ----------

-- Public catalog: only status = 'active'. Optional filters are NULL to skip.
-- q is matched with ILIKE; the caller escapes % _ \ in it.
-- sort: 'price_asc' | 'price_desc' | anything else = newest first.
-- name: ListActiveListings :many
SELECT * FROM listings
WHERE status = 'active'
  AND (sqlc.narg('listing_type')::text  IS NULL OR listing_type  = sqlc.narg('listing_type'))
  AND (sqlc.narg('property_type')::text IS NULL OR property_type = sqlc.narg('property_type'))
  AND (sqlc.narg('city')::text          IS NULL OR lower(city)     = lower(sqlc.narg('city')))
  AND (sqlc.narg('locality')::text      IS NULL OR lower(locality) = lower(sqlc.narg('locality')))
  AND (sqlc.narg('min_price')::bigint   IS NULL OR price >= sqlc.narg('min_price'))
  AND (sqlc.narg('max_price')::bigint   IS NULL OR price <= sqlc.narg('max_price'))
  AND (sqlc.narg('min_bedrooms')::bigint IS NULL OR bedrooms >= sqlc.narg('min_bedrooms'))
  AND (sqlc.narg('q')::text IS NULL
       OR title       ILIKE '%' || sqlc.narg('q') || '%'
       OR description ILIKE '%' || sqlc.narg('q') || '%'
       OR city        ILIKE '%' || sqlc.narg('q') || '%'
       OR locality    ILIKE '%' || sqlc.narg('q') || '%')
ORDER BY
  CASE WHEN sqlc.arg('sort')::text = 'price_asc'  THEN price END ASC,
  CASE WHEN sqlc.arg('sort')::text = 'price_desc' THEN price END DESC,
  created_at DESC, id
LIMIT sqlc.arg('limit')::bigint OFFSET sqlc.arg('offset')::bigint;

-- name: CountActiveListings :one
SELECT count(*) FROM listings
WHERE status = 'active'
  AND (sqlc.narg('listing_type')::text  IS NULL OR listing_type  = sqlc.narg('listing_type'))
  AND (sqlc.narg('property_type')::text IS NULL OR property_type = sqlc.narg('property_type'))
  AND (sqlc.narg('city')::text          IS NULL OR lower(city)     = lower(sqlc.narg('city')))
  AND (sqlc.narg('locality')::text      IS NULL OR lower(locality) = lower(sqlc.narg('locality')))
  AND (sqlc.narg('min_price')::bigint   IS NULL OR price >= sqlc.narg('min_price'))
  AND (sqlc.narg('max_price')::bigint   IS NULL OR price <= sqlc.narg('max_price'))
  AND (sqlc.narg('min_bedrooms')::bigint IS NULL OR bedrooms >= sqlc.narg('min_bedrooms'))
  AND (sqlc.narg('q')::text IS NULL
       OR title       ILIKE '%' || sqlc.narg('q') || '%'
       OR description ILIKE '%' || sqlc.narg('q') || '%'
       OR city        ILIKE '%' || sqlc.narg('q') || '%'
       OR locality    ILIKE '%' || sqlc.narg('q') || '%');

-- name: ListFeaturedListings :many
SELECT * FROM listings
WHERE status = 'active' AND featured
ORDER BY created_at DESC, id
LIMIT sqlc.arg('limit')::bigint;

-- name: GetActiveListingBySlug :one
SELECT * FROM listings WHERE slug = $1 AND status = 'active';

-- ---------- facets (active listings only) ----------

-- name: FacetPurposes :many
SELECT listing_type, count(*) AS count, min(price)::bigint AS min_price, max(price)::bigint AS max_price
FROM listings WHERE status = 'active'
GROUP BY listing_type ORDER BY listing_type;

-- name: FacetPropertyTypes :many
SELECT property_type, count(*) AS count
FROM listings WHERE status = 'active'
GROUP BY property_type ORDER BY property_type;

-- name: FacetCities :many
SELECT city, count(*) AS count
FROM listings WHERE status = 'active'
GROUP BY city ORDER BY city;

-- name: FacetLocalities :many
SELECT city, locality, count(*) AS count
FROM listings WHERE status = 'active' AND locality <> ''
GROUP BY city, locality ORDER BY city, locality;

-- name: FacetBedrooms :many
SELECT bedrooms::bigint AS bedrooms, count(*) AS count
FROM listings WHERE status = 'active' AND bedrooms IS NOT NULL
GROUP BY bedrooms ORDER BY bedrooms;

-- Admin: every status, optional status filter.
-- name: ListListings :many
SELECT * FROM listings
WHERE (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'))
ORDER BY created_at DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountListings :one
SELECT count(*) FROM listings
WHERE (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'));

-- name: GetListing :one
SELECT * FROM listings WHERE id = $1;

-- name: CreateListing :one
INSERT INTO listings (
  slug, title, description, listing_type, property_type, status,
  price, bedrooms, bathrooms, area, city, locality, address, featured
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
)
RETURNING *;

-- name: UpdateListing :one
UPDATE listings SET
  slug = $2, title = $3, description = $4, listing_type = $5, property_type = $6, status = $7,
  price = $8, bedrooms = $9, bathrooms = $10, area = $11, city = $12, locality = $13,
  address = $14, featured = $15, updated_at = now()
WHERE id = $1
RETURNING *;

-- Seed only: idempotent by slug.
-- name: UpsertListingBySlug :one
INSERT INTO listings (
  slug, title, description, listing_type, property_type, status,
  price, bedrooms, bathrooms, area, city, locality, address, featured
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  listing_type = EXCLUDED.listing_type, property_type = EXCLUDED.property_type,
  status = EXCLUDED.status, price = EXCLUDED.price, bedrooms = EXCLUDED.bedrooms,
  bathrooms = EXCLUDED.bathrooms, area = EXCLUDED.area, city = EXCLUDED.city,
  locality = EXCLUDED.locality, address = EXCLUDED.address, featured = EXCLUDED.featured,
  updated_at = now()
RETURNING *;

-- name: DeleteListing :execrows
DELETE FROM listings WHERE id = $1;

-- ---------- listing_media ----------

-- name: ListListingMedia :many
SELECT * FROM listing_media WHERE listing_id = $1 ORDER BY position, created_at;

-- Batch fetch for a page of listings (avoids N+1).
-- name: ListMediaForListings :many
SELECT * FROM listing_media
WHERE listing_id = ANY(sqlc.arg('listing_ids')::uuid[])
ORDER BY listing_id, position, created_at;

-- name: CreateListingMedia :one
INSERT INTO listing_media (listing_id, path, media_type, position)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateListingMediaPosition :execrows
UPDATE listing_media SET position = $3 WHERE id = $1 AND listing_id = $2;

-- Returns the deleted row so the caller can remove the file from disk.
-- name: DeleteListingMedia :one
DELETE FROM listing_media WHERE id = $1 AND listing_id = $2
RETURNING *;
