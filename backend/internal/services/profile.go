package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

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

// DefaultAgencyName is the site name used when the profile has no agency_name.
const DefaultAgencyName = "BrickBot"

// ProcessStep is one entry of salesman_profile.process_steps.
type ProcessStep struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

// PublicProfile is the profile with its JSON columns decoded and the agency
// name resolved, ready for the public API.
type PublicProfile struct {
	db.SalesmanProfile
	AgencyName   string
	ProcessSteps []ProcessStep
	Socials      map[string]string
}

// GetPublic returns the profile for public display.
func (s *ProfileService) GetPublic(ctx context.Context) (PublicProfile, error) {
	p, err := s.Get(ctx)
	if err != nil {
		return PublicProfile{}, err
	}
	out := PublicProfile{SalesmanProfile: p, AgencyName: DefaultAgencyName, ProcessSteps: []ProcessStep{}, Socials: map[string]string{}}
	if p.AgencyName != nil && strings.TrimSpace(*p.AgencyName) != "" {
		out.AgencyName = *p.AgencyName
	}
	if err := json.Unmarshal(p.ProcessSteps, &out.ProcessSteps); err != nil {
		return PublicProfile{}, fmt.Errorf("decode process_steps: %w", err)
	}
	if err := json.Unmarshal(p.Socials, &out.Socials); err != nil {
		return PublicProfile{}, fmt.Errorf("decode socials: %w", err)
	}
	// A JSON null decodes to nil; the API always sends [] and {}.
	if out.ProcessSteps == nil {
		out.ProcessSteps = []ProcessStep{}
	}
	if out.Socials == nil {
		out.Socials = map[string]string{}
	}
	return out, nil
}
