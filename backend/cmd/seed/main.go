// Package main seeds the salesman profile and sample listings. It is
// idempotent: the profile (and its admin credentials) is created only if
// missing, and listings are upserted by slug.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"brickbot/internal/db"
)

const minPasswordLen = 12

type seedProfile struct {
	Name           string   `json:"name"`
	Phone          string   `json:"phone"`
	WhatsappNumber string   `json:"whatsapp_number"`
	Email          string   `json:"email"`
	Bio            string   `json:"bio"`
	ServiceAreas   []string `json:"service_areas"`
}

type seedListing struct {
	Slug         string `json:"slug"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	Purpose      string `json:"purpose"`
	PropertyType string `json:"property_type"`
	Status       string `json:"status"`
	Price        int64  `json:"price"`
	Bedrooms     *int16 `json:"bedrooms"`
	Bathrooms    *int16 `json:"bathrooms"`
	Area         *int32 `json:"area"`
	City         string `json:"city"`
	Locality     string `json:"locality"`
	Address      string `json:"address"`
	Featured     bool   `json:"featured"`
}

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("seed", "err", err)
		os.Exit(1)
	}
}

func run() error {
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return errors.New("DATABASE_URL is required")
	}
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		return fmt.Errorf("db pool: %w", err)
	}
	defer pool.Close()
	q := db.New(pool)

	if err := seedProfileRow(ctx, q); err != nil {
		return err
	}
	return seedListings(ctx, q)
}

// seedProfileRow creates the profile only if it is missing. ADMIN_EMAIL and
// ADMIN_PASSWORD are read only in that case; changing them later has no effect.
func seedProfileRow(ctx context.Context, q *db.Queries) error {
	_, err := q.GetProfile(ctx)
	if err == nil {
		slog.Info("profile exists, leaving it and its admin credentials unchanged")
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("get profile: %w", err)
	}

	email := strings.TrimSpace(os.Getenv("ADMIN_EMAIL"))
	password := os.Getenv("ADMIN_PASSWORD")
	if email == "" || !strings.Contains(email, "@") {
		return errors.New("ADMIN_EMAIL must be set to an email address to create the profile")
	}
	if len(password) < minPasswordLen {
		return fmt.Errorf("ADMIN_PASSWORD must be at least %d characters to create the profile", minPasswordLen)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	var p seedProfile
	if err := readJSON("seed/profile.json", &p); err != nil {
		return err
	}
	if p.ServiceAreas == nil {
		p.ServiceAreas = []string{} // a nil slice would insert NULL
	}
	if err := q.CreateProfileIfMissing(ctx, db.CreateProfileIfMissingParams{
		Name:              p.Name,
		Phone:             p.Phone,
		WhatsappNumber:    p.WhatsappNumber,
		Email:             p.Email,
		Bio:               p.Bio,
		ServiceAreas:      p.ServiceAreas,
		AdminEmail:        email,
		AdminPasswordHash: string(hash),
	}); err != nil {
		return fmt.Errorf("create profile: %w", err)
	}
	slog.Info("profile created")
	return nil
}

func seedListings(ctx context.Context, q *db.Queries) error {
	var listings []seedListing
	if err := readJSON("seed/listings.json", &listings); err != nil {
		return err
	}
	for _, l := range listings {
		if _, err := q.UpsertListingBySlug(ctx, db.UpsertListingBySlugParams{
			Slug: l.Slug, Title: l.Title, Description: l.Description,
			ListingType: l.Purpose, PropertyType: l.PropertyType, Status: l.Status,
			Price: l.Price, Bedrooms: l.Bedrooms, Bathrooms: l.Bathrooms, Area: l.Area,
			City: l.City, Locality: l.Locality, Address: l.Address, Featured: l.Featured,
		}); err != nil {
			return fmt.Errorf("upsert listing %q: %w", l.Slug, err)
		}
	}
	slog.Info("listings upserted", "count", len(listings))
	return nil
}

func readJSON(path string, v any) error {
	b, err := os.ReadFile(path) // #nosec G304 -- fixed paths inside the repo
	if err != nil {
		return fmt.Errorf("read %s: %w", path, err)
	}
	if err := json.Unmarshal(b, v); err != nil {
		return fmt.Errorf("parse %s: %w", path, err)
	}
	return nil
}
