-- listing_slug is set only while the linked listing is active and not deleted.
-- name: ListPublishedTestimonials :many
SELECT t.id, t.author_name, t.author_title, t.author_photo_url, t.quote, t.rating,
       l.slug AS listing_slug, t.created_at
FROM testimonials t
LEFT JOIN listings l ON l.id = t.listing_id AND l.status = 'active' AND l.deleted_at IS NULL
WHERE t.is_published
ORDER BY t.position, t.created_at;

-- name: GetTestimonialByID :one
SELECT * FROM testimonials WHERE id = $1;
