-- ---------- inquiries ----------

-- name: CreateInquiry :one
INSERT INTO inquiries (listing_id, name, phone, email, message, source)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- Admin: newest first, optional status filter. Joins the listing for display.
-- name: ListInquiries :many
SELECT i.*, l.slug AS listing_slug, l.title AS listing_title
FROM inquiries i
LEFT JOIN listings l ON l.id = i.listing_id
WHERE (sqlc.narg('status')::text IS NULL OR i.status = sqlc.narg('status'))
ORDER BY i.created_at DESC, i.id
LIMIT sqlc.arg('limit')::bigint OFFSET sqlc.arg('offset')::bigint;

-- name: CountInquiries :one
SELECT count(*) FROM inquiries
WHERE (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status'));

-- name: GetInquiry :one
SELECT i.*, l.slug AS listing_slug, l.title AS listing_title
FROM inquiries i
LEFT JOIN listings l ON l.id = i.listing_id
WHERE i.id = $1;

-- Triage. NULL leaves a field unchanged.
-- name: UpdateInquiry :execrows
UPDATE inquiries SET
  status     = COALESCE(sqlc.narg('status'), status),
  admin_note = COALESCE(sqlc.narg('admin_note'), admin_note),
  updated_at = now()
WHERE id = sqlc.arg('id');
