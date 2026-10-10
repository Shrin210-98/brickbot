package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"brickbot/internal/db"
)

// ProfileService reads the singleton salesman profile.
type ProfileService struct {
	q *db.Queries
}

// NewProfileService returns a ProfileService backed by q.
func NewProfileService(q *db.Queries) *ProfileService {
	return &ProfileService{q: q}
}

// Get returns the profile, or ErrNotFound if it has not been seeded yet.
func (s *ProfileService) Get(ctx context.Context) (db.SalesmanProfile, error) {
	p, err := s.q.GetProfile(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.SalesmanProfile{}, fmt.Errorf("%w: profile", ErrNotFound)
	}
	if err != nil {
		return db.SalesmanProfile{}, fmt.Errorf("get profile: %w", err)
	}
	return p, nil
}
