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
