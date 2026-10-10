package handlers

import (
	"net/http"
	"time"

	"brickbot/internal/httpx"
	"brickbot/internal/services"
)

// TestimonialsHandler serves the public testimonials.
type TestimonialsHandler struct {
	svc *services.TestimonialService
}

// NewTestimonialsHandler returns a TestimonialsHandler.
func NewTestimonialsHandler(svc *services.TestimonialService) *TestimonialsHandler {
	return &TestimonialsHandler{svc: svc}
}

type testimonialDTO struct {
	ID             string    `json:"id"`
	AuthorName     string    `json:"author_name"`
	AuthorTitle    *string   `json:"author_title"`
	AuthorPhotoURL *string   `json:"author_photo_url"`
	Quote          string    `json:"quote"`
	Rating         *int16    `json:"rating"`
	ListingSlug    *string   `json:"listing_slug"`
	CreatedAt      time.Time `json:"created_at"`
}

// List handles GET /api/testimonials.
func (h *TestimonialsHandler) List(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.ListPublished(r.Context())
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	items := make([]testimonialDTO, len(rows))
	for i, t := range rows {
		items[i] = testimonialDTO{
			ID:             uuidString(t.ID),
			AuthorName:     t.AuthorName,
			AuthorTitle:    t.AuthorTitle,
			AuthorPhotoURL: t.AuthorPhotoUrl,
			Quote:          t.Quote,
			Rating:         t.Rating,
			ListingSlug:    t.ListingSlug,
			CreatedAt:      timeOf(t.CreatedAt),
		}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string][]testimonialDTO{"items": items})
}
