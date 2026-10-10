package services

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"brickbot/internal/db"
)

const (
	maxSlugBase       = 80
	maxSlugSuffix     = 1000
	pgUniqueViolation = "23505"
)

// AdminListingService manages listings in every status. Soft-deleted listings
// behave as if they do not exist.
type AdminListingService struct {
	q *db.Queries
}

// NewAdminListingService returns an AdminListingService backed by q.
func NewAdminListingService(q *db.Queries) *AdminListingService {
	return &AdminListingService{q: q}
}

// ListingInput is the editable part of a listing. On update, an empty Slug or
// Status keeps the current value; on create, an empty Slug is generated from
// Title and an empty Status means "draft".
type ListingInput struct {
	Slug         string
	Title        string
	Description  string
	Purpose      string // listing_type
	PropertyType string
	Status       string
	Price        int64
	Bedrooms     *int16
	Bathrooms    *int16
	Area         *int32
	City         string
	Locality     string
	Address      string
	Featured     bool
}

// List returns one page of non-deleted listings, newest first, optionally by status.
func (s *AdminListingService) List(ctx context.Context, status string, page, pageSize int64) ([]ListingWithMedia, int64, error) {
	total, err := s.q.CountListings(ctx, optString(status))
	if err != nil {
		return nil, 0, fmt.Errorf("count listings: %w", err)
	}
	rows, err := s.q.ListListings(ctx, db.ListListingsParams{
		Status: optString(status),
		Limit:  pageSize,
		Offset: (page - 1) * pageSize,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("list listings: %w", err)
	}
	items, err := withMedia(ctx, s.q, rows)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// Get returns one non-deleted listing with media, or ErrNotFound.
func (s *AdminListingService) Get(ctx context.Context, id pgtype.UUID) (ListingWithMedia, error) {
	l, err := getListing(ctx, s.q, id)
	if err != nil {
		return ListingWithMedia{}, err
	}
	media, err := s.q.ListListingMedia(ctx, l.ID)
	if err != nil {
		return ListingWithMedia{}, fmt.Errorf("list listing media: %w", err)
	}
	return ListingWithMedia{Listing: l, Media: media}, nil
}

// Create inserts a listing. A taken slug is ErrConflict.
func (s *AdminListingService) Create(ctx context.Context, in ListingInput) (ListingWithMedia, error) {
	if in.Slug == "" {
		slug, err := s.freeSlug(ctx, Slugify(in.Title))
		if err != nil {
			return ListingWithMedia{}, err
		}
		in.Slug = slug
	}
	if in.Status == "" {
		in.Status = "draft"
	}
	l, err := s.q.CreateListing(ctx, db.CreateListingParams{
		Slug: in.Slug, Title: in.Title, Description: in.Description,
		ListingType: in.Purpose, PropertyType: in.PropertyType, Status: in.Status,
		Price: in.Price, Bedrooms: in.Bedrooms, Bathrooms: in.Bathrooms, Area: in.Area,
		City: in.City, Locality: in.Locality, Address: in.Address, Featured: in.Featured,
	})
	if isUniqueViolation(err) {
		return ListingWithMedia{}, fmt.Errorf("%w: slug is already taken", ErrConflict)
	}
	if err != nil {
		return ListingWithMedia{}, fmt.Errorf("create listing: %w", err)
	}
	return ListingWithMedia{Listing: l, Media: []db.ListingMedia{}}, nil
}

// Update replaces a listing's fields, or returns ErrNotFound / ErrConflict.
func (s *AdminListingService) Update(ctx context.Context, id pgtype.UUID, in ListingInput) (ListingWithMedia, error) {
	cur, err := getListing(ctx, s.q, id)
	if err != nil {
		return ListingWithMedia{}, err
	}
	if in.Slug == "" {
		in.Slug = cur.Slug
	}
	if in.Status == "" {
		in.Status = cur.Status
	}
	_, err = s.q.UpdateListing(ctx, db.UpdateListingParams{
		ID:   id,
		Slug: in.Slug, Title: in.Title, Description: in.Description,
		ListingType: in.Purpose, PropertyType: in.PropertyType, Status: in.Status,
		Price: in.Price, Bedrooms: in.Bedrooms, Bathrooms: in.Bathrooms, Area: in.Area,
		City: in.City, Locality: in.Locality, Address: in.Address, Featured: in.Featured,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return ListingWithMedia{}, fmt.Errorf("%w: listing", ErrNotFound)
	}
	if isUniqueViolation(err) {
		return ListingWithMedia{}, fmt.Errorf("%w: slug is already taken", ErrConflict)
	}
	if err != nil {
		return ListingWithMedia{}, fmt.Errorf("update listing: %w", err)
	}
	return s.Get(ctx, id)
}

// Delete soft-deletes a listing, or returns ErrNotFound.
func (s *AdminListingService) Delete(ctx context.Context, id pgtype.UUID) error {
	n, err := s.q.DeleteListing(ctx, id)
	if err != nil {
		return fmt.Errorf("delete listing: %w", err)
	}
	if n == 0 {
		return fmt.Errorf("%w: listing", ErrNotFound)
	}
	return nil
}

// freeSlug returns base, or base-2, base-3, … whichever is not taken.
// Soft-deleted listings keep their slugs.
func (s *AdminListingService) freeSlug(ctx context.Context, base string) (string, error) {
	for i := 1; i <= maxSlugSuffix; i++ {
		slug := base
		if i > 1 {
			slug = base + "-" + strconv.Itoa(i)
		}
		taken, err := s.q.ListingSlugExists(ctx, slug)
		if err != nil {
			return "", fmt.Errorf("check slug: %w", err)
		}
		if !taken {
			return slug, nil
		}
	}
	return "", fmt.Errorf("%w: no free slug for this title; pass one explicitly", ErrConflict)
}

// Slugify lowercases s and joins its ASCII letter/digit runs with hyphens,
// e.g. "2 BHK in Andheri (West)" → "2-bhk-in-andheri-west". It falls back to
// "listing" when nothing usable remains.
func Slugify(s string) string {
	var b strings.Builder
	dash := false
	for _, r := range strings.ToLower(s) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			if dash && b.Len() > 0 {
				b.WriteByte('-')
			}
			dash = false
			b.WriteRune(r)
			continue
		}
		dash = true
	}
	out := b.String()
	if len(out) > maxSlugBase {
		out = strings.TrimRight(out[:maxSlugBase], "-")
	}
	if out == "" {
		return "listing"
	}
	return out
}

// getListing loads a non-deleted listing, or ErrNotFound.
func getListing(ctx context.Context, q *db.Queries, id pgtype.UUID) (db.Listing, error) {
	l, err := q.GetListing(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Listing{}, fmt.Errorf("%w: listing", ErrNotFound)
	}
	if err != nil {
		return db.Listing{}, fmt.Errorf("get listing: %w", err)
	}
	return l, nil
}

func isUniqueViolation(err error) bool {
	pgErr, ok := errors.AsType[*pgconn.PgError](err)
	return ok && pgErr.Code == pgUniqueViolation
}
