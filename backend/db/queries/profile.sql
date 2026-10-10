-- name: GetProfile :one
SELECT * FROM salesman_profile WHERE id = 1;

-- Seed only: inserts the singleton row if it is missing, never overwrites it.
-- name: CreateProfileIfMissing :exec
INSERT INTO salesman_profile (id, name, phone, whatsapp_number, email, bio, service_areas, admin_email, admin_password_hash)
VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (id) DO NOTHING;

-- name: GetAdminCredentials :one
SELECT admin_email, admin_password_hash FROM salesman_profile WHERE id = 1;

-- name: UpdateProfile :one
UPDATE salesman_profile
SET name = $1, phone = $2, whatsapp_number = $3, email = $4, bio = $5, service_areas = $6,
    photo_path = $7, country_code = $8, currency = $9, area_unit = $10, updated_at = now()
WHERE id = 1
RETURNING *;

-- name: UpdateAdminPasswordHash :exec
UPDATE salesman_profile SET admin_password_hash = $1, updated_at = now() WHERE id = 1;

-- Seed only: fills the marketing fields that are still empty, never overwrites them.
-- name: FillProfileMarketing :exec
UPDATE salesman_profile
SET tagline          = COALESCE(NULLIF(tagline, ''), sqlc.narg('tagline')),
    headline         = COALESCE(NULLIF(headline, ''), sqlc.narg('headline')),
    license_no       = COALESCE(NULLIF(license_no, ''), sqlc.narg('license_no')),
    agency_name      = COALESCE(NULLIF(agency_name, ''), sqlc.narg('agency_name')),
    years_experience = COALESCE(years_experience, sqlc.narg('years_experience')),
    deals_closed     = COALESCE(deals_closed, sqlc.narg('deals_closed')),
    specialties      = CASE WHEN cardinality(specialties) = 0 THEN sqlc.arg('specialties')::text[] ELSE specialties END,
    process_steps    = CASE WHEN process_steps = '[]'::jsonb THEN sqlc.arg('process_steps')::jsonb ELSE process_steps END,
    socials          = CASE WHEN socials = '{}'::jsonb THEN sqlc.arg('socials')::jsonb ELSE socials END,
    updated_at       = now()
WHERE id = 1;
