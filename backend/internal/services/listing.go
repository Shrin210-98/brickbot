package services

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"brickbot/internal/db"
)

// featuredLimit caps GET /api/listings/featured.
const featuredLimit = 6

// ListingService serves the public (status = 'active') catalog.
type ListingService struct {
	q *db.Queries
}

// NewListingService returns a ListingService backed by q.
func NewListingService(q *db.Queries) *ListingService {
	return &ListingService{q: q}
}

// ListingFilter holds the optional public catalog filters. Empty strings and
// nil pointers mean "no filter".
type ListingFilter struct {
	Purpose      string // listing_type: sale | rent
	PropertyType string
	City         string
	Locality     string
	Q            string
	MinPrice     *int64
	MaxPrice     *int64
	MinBedrooms  *int64
	Sort         string // newest | price_asc | price_desc
}

// ListingWithMedia is a listing plus its media ordered by position.
type ListingWithMedia struct {
	db.Listing
	Media []db.ListingMedia
}

// Facets are counts over active listings, for building filter UIs.
type Facets struct {
	Purposes      []db.FacetPurposesRow
	PropertyTypes []db.FacetPropertyTypesRow
	Cities        []db.FacetCitiesRow
	Localities    []db.FacetLocalitiesRow
	Bedrooms      []db.FacetBedroomsRow
}

// List returns one page of active listings matching f, and the total match count.
func (s *ListingService) List(ctx context.Context, f ListingFilter, page, pageSize int64) ([]ListingWithMedia, int64, error) {
	if f.MinPrice != nil && f.MaxPrice != nil && *f.MinPrice > *f.MaxPrice {
		return nil, 0, fmt.Errorf("%w: min_price must not exceed max_price", ErrInvalid)
	}
	var q *string
	if f.Q != "" {
		q = ptr(escapeLike(f.Q))
	}

	total, err := s.q.CountActiveListings(ctx, db.CountActiveListingsParams{
		ListingType:  optString(f.Purpose),
		PropertyType: optString(f.PropertyType),
		City:         optString(f.City),
		Locality:     optString(f.Locality),
		MinPrice:     f.MinPrice,
		MaxPrice:     f.MaxPrice,
		MinBedrooms:  f.MinBedrooms,
		Q:            q,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("count listings: %w", err)
	}

	rows, err := s.q.ListActiveListings(ctx, db.ListActiveListingsParams{
		ListingType:  optString(f.Purpose),
		PropertyType: optString(f.PropertyType),
		City:         optString(f.City),
		Locality:     optString(f.Locality),
		MinPrice:     f.MinPrice,
		MaxPrice:     f.MaxPrice,
		MinBedrooms:  f.MinBedrooms,
		Q:            q,
		Sort:         f.Sort,
		Limit:        pageSize,
		Offset:       (page - 1) * pageSize,
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

// Featured returns up to featuredLimit active, featured listings, newest first.
func (s *ListingService) Featured(ctx context.Context) ([]ListingWithMedia, error) {
	rows, err := s.q.ListFeaturedListings(ctx, featuredLimit)
	if err != nil {
		return nil, fmt.Errorf("list featured listings: %w", err)
	}
	return withMedia(ctx, s.q, rows)
}

// GetBySlug returns one active listing with its media, or ErrNotFound.
func (s *ListingService) GetBySlug(ctx context.Context, slug string) (ListingWithMedia, error) {
	l, err := s.q.GetActiveListingBySlug(ctx, slug)
	if errors.Is(err, pgx.ErrNoRows) {
		return ListingWithMedia{}, fmt.Errorf("%w: listing", ErrNotFound)
	}
	if err != nil {
		return ListingWithMedia{}, fmt.Errorf("get listing: %w", err)
	}
	media, err := s.q.ListListingMedia(ctx, l.ID)
	if err != nil {
		return ListingWithMedia{}, fmt.Errorf("list listing media: %w", err)
	}
	return ListingWithMedia{Listing: l, Media: media}, nil
}

// Facets returns counts per purpose (with price range), property type, city,
// locality and bedroom count over active listings.
func (s *ListingService) Facets(ctx context.Context) (Facets, error) {
	var (
		f   Facets
		err error
	)
	if f.Purposes, err = s.q.FacetPurposes(ctx); err != nil {
		return Facets{}, fmt.Errorf("facet purposes: %w", err)
	}
	if f.PropertyTypes, err = s.q.FacetPropertyTypes(ctx); err != nil {
		return Facets{}, fmt.Errorf("facet property types: %w", err)
	}
	if f.Cities, err = s.q.FacetCities(ctx); err != nil {
		return Facets{}, fmt.Errorf("facet cities: %w", err)
	}
	if f.Localities, err = s.q.FacetLocalities(ctx); err != nil {
		return Facets{}, fmt.Errorf("facet localities: %w", err)
	}
	if f.Bedrooms, err = s.q.FacetBedrooms(ctx); err != nil {
		return Facets{}, fmt.Errorf("facet bedrooms: %w", err)
	}
	return f, nil
}

// withMedia attaches media to rows with one batch query.
func withMedia(ctx context.Context, q *db.Queries, rows []db.Listing) ([]ListingWithMedia, error) {
	out := make([]ListingWithMedia, len(rows))
	if len(rows) == 0 {
		return out, nil
	}
	ids := make([]pgtype.UUID, len(rows))
	for i, l := range rows {
		ids[i] = l.ID
	}
	media, err := q.ListMediaForListings(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("list media for listings: %w", err)
	}
	byListing := make(map[[16]byte][]db.ListingMedia, len(rows))
	for _, m := range media {
		byListing[m.ListingID.Bytes] = append(byListing[m.ListingID.Bytes], m)
	}
	for i, l := range rows {
		m := byListing[l.ID.Bytes]
		if m == nil {
			m = []db.ListingMedia{}
		}
		out[i] = ListingWithMedia{Listing: l, Media: m}
	}
	return out, nil
}

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

// escapeLike makes s match literally inside an ILIKE pattern.
func escapeLike(s string) string { return likeEscaper.Replace(s) }

func optString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func ptr[T any](v T) *T { return &v }
