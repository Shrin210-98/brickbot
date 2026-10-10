package services

import (
	"context"
	"fmt"

	"brickbot/internal/db"
)

// TestimonialService serves the published client testimonials.
type TestimonialService struct {
	q *db.Queries
}

// NewTestimonialService returns a TestimonialService backed by q.
func NewTestimonialService(q *db.Queries) *TestimonialService {
	return &TestimonialService{q: q}
}

// ListPublished returns the published testimonials ordered by position.
func (s *TestimonialService) ListPublished(ctx context.Context) ([]db.ListPublishedTestimonialsRow, error) {
	rows, err := s.q.ListPublishedTestimonials(ctx)
	if err != nil {
		return nil, fmt.Errorf("list testimonials: %w", err)
	}
	return rows, nil
}
