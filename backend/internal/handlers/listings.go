package handlers

import (
	"net/http"
	"time"

	"brickbot/internal/db"
	"brickbot/internal/httpx"
	"brickbot/internal/services"
)

// ListingsHandler serves the public listing catalog.
type ListingsHandler struct {
	svc *services.ListingService
}

// NewListingsHandler returns a ListingsHandler.
func NewListingsHandler(svc *services.ListingService) *ListingsHandler {
	return &ListingsHandler{svc: svc}
}

// listingsQuery is GET /api/listings' query string, after parsing.
type listingsQuery struct {
	Purpose  string `json:"purpose" validate:"omitempty,oneof=sale rent"`
	Type     string `json:"type" validate:"omitempty,oneof=apartment house villa plot commercial other"`
	City     string `json:"city" validate:"max=100"`
	Locality string `json:"locality" validate:"max=100"`
	MinPrice *int64 `json:"min_price" validate:"omitempty,min=0"`
	MaxPrice *int64 `json:"max_price" validate:"omitempty,min=0"`
	Beds     *int64 `json:"beds" validate:"omitempty,min=0,max=50"`
	Q        string `json:"q" validate:"max=100"`
	Sort     string `json:"sort" validate:"omitempty,oneof=newest price_asc price_desc"`
	Page     int64  `json:"page" validate:"min=1,max=10000"`
	PageSize int64  `json:"page_size" validate:"min=1,max=100"`
}

type mediaDTO struct {
	ID        string `json:"id"`
	URL       string `json:"url"`
	MediaType string `json:"media_type"`
	Position  int32  `json:"position"`
}

type listingSummaryDTO struct {
	ID           string    `json:"id"`
	Slug         string    `json:"slug"`
	Title        string    `json:"title"`
	Purpose      string    `json:"purpose"`
	PropertyType string    `json:"property_type"`
	Status       string    `json:"status"`
	Price        int64     `json:"price"`
	Bedrooms     *int16    `json:"bedrooms"`
	Bathrooms    *int16    `json:"bathrooms"`
	Area         *int32    `json:"area"`
	City         string    `json:"city"`
	Locality     string    `json:"locality"`
	Featured     bool      `json:"featured"`
	CoverURL     *string   `json:"cover_url"`
	CreatedAt    time.Time `json:"created_at"`
}

type listingDetailDTO struct {
	listingSummaryDTO
	Description string     `json:"description"`
	Address     string     `json:"address"`
	Media       []mediaDTO `json:"media"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type valueCountDTO struct {
	Value string `json:"value"`
	Count int64  `json:"count"`
}

type purposeFacetDTO struct {
	Value    string `json:"value"`
	Count    int64  `json:"count"`
	MinPrice int64  `json:"min_price"`
	MaxPrice int64  `json:"max_price"`
}

type localityFacetDTO struct {
	City  string `json:"city"`
	Value string `json:"value"`
	Count int64  `json:"count"`
}

type bedroomsFacetDTO struct {
	Value int64 `json:"value"`
	Count int64 `json:"count"`
}

type facetsDTO struct {
	Purposes      []purposeFacetDTO  `json:"purposes"`
	PropertyTypes []valueCountDTO    `json:"property_types"`
	Cities        []valueCountDTO    `json:"cities"`
	Localities    []localityFacetDTO `json:"localities"`
	Bedrooms      []bedroomsFacetDTO `json:"bedrooms"`
}

// List handles GET /api/listings.
func (h *ListingsHandler) List(w http.ResponseWriter, r *http.Request) {
	qp := httpx.NewQuery(r)
	in := listingsQuery{
		Purpose:  qp.String("purpose"),
		Type:     qp.String("type"),
		City:     qp.String("city"),
		Locality: qp.String("locality"),
		MinPrice: qp.OptInt64("min_price"),
		MaxPrice: qp.OptInt64("max_price"),
		Beds:     qp.OptInt64("beds"),
		Q:        qp.String("q"),
		Sort:     qp.String("sort"),
		Page:     qp.Int64("page", httpx.DefaultPage),
		PageSize: qp.Int64("page_size", httpx.DefaultPageSize),
	}
	if qp.BadRequest(w) || !httpx.Validate(w, in) {
		return
	}

	rows, total, err := h.svc.List(r.Context(), services.ListingFilter{
		Purpose:      in.Purpose,
		PropertyType: in.Type,
		City:         in.City,
		Locality:     in.Locality,
		Q:            in.Q,
		MinPrice:     in.MinPrice,
		MaxPrice:     in.MaxPrice,
		MinBedrooms:  in.Beds,
		Sort:         in.Sort,
	}, in.Page, in.PageSize)
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, httpx.Page[listingSummaryDTO]{
		Items:    toSummaries(rows),
		Total:    total,
		Page:     in.Page,
		PageSize: in.PageSize,
	})
}

// Featured handles GET /api/listings/featured.
func (h *ListingsHandler) Featured(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.Featured(r.Context())
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string][]listingSummaryDTO{"items": toSummaries(rows)})
}

// Get handles GET /api/listings/{slug}.
func (h *ListingsHandler) Get(w http.ResponseWriter, r *http.Request) {
	l, err := h.svc.GetBySlug(r.Context(), r.PathValue("slug"))
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	media := make([]mediaDTO, len(l.Media))
	for i, m := range l.Media {
		media[i] = mediaDTO{ID: uuidString(m.ID), URL: mediaURL(m.Path), MediaType: m.MediaType, Position: m.Position}
	}
	httpx.WriteJSON(w, http.StatusOK, listingDetailDTO{
		listingSummaryDTO: toSummary(l),
		Description:       l.Description,
		Address:           l.Address,
		Media:             media,
		UpdatedAt:         timeOf(l.UpdatedAt),
	})
}

// Facets handles GET /api/listings/facets.
func (h *ListingsHandler) Facets(w http.ResponseWriter, r *http.Request) {
	f, err := h.svc.Facets(r.Context())
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	out := facetsDTO{
		Purposes:      make([]purposeFacetDTO, len(f.Purposes)),
		PropertyTypes: make([]valueCountDTO, len(f.PropertyTypes)),
		Cities:        make([]valueCountDTO, len(f.Cities)),
		Localities:    make([]localityFacetDTO, len(f.Localities)),
		Bedrooms:      make([]bedroomsFacetDTO, len(f.Bedrooms)),
	}
	for i, p := range f.Purposes {
		out.Purposes[i] = purposeFacetDTO{Value: p.ListingType, Count: p.Count, MinPrice: p.MinPrice, MaxPrice: p.MaxPrice}
	}
	for i, p := range f.PropertyTypes {
		out.PropertyTypes[i] = valueCountDTO{Value: p.PropertyType, Count: p.Count}
	}
	for i, c := range f.Cities {
		out.Cities[i] = valueCountDTO{Value: c.City, Count: c.Count}
	}
	for i, l := range f.Localities {
		out.Localities[i] = localityFacetDTO{City: l.City, Value: l.Locality, Count: l.Count}
	}
	for i, b := range f.Bedrooms {
		out.Bedrooms[i] = bedroomsFacetDTO{Value: b.Bedrooms, Count: b.Count}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func toSummaries(rows []services.ListingWithMedia) []listingSummaryDTO {
	out := make([]listingSummaryDTO, len(rows))
	for i, l := range rows {
		out[i] = toSummary(l)
	}
	return out
}

func toSummary(l services.ListingWithMedia) listingSummaryDTO {
	return listingSummaryDTO{
		ID:           uuidString(l.ID),
		Slug:         l.Slug,
		Title:        l.Title,
		Purpose:      l.ListingType,
		PropertyType: l.PropertyType,
		Status:       l.Status,
		Price:        l.Price,
		Bedrooms:     l.Bedrooms,
		Bathrooms:    l.Bathrooms,
		Area:         l.Area,
		City:         l.City,
		Locality:     l.Locality,
		Featured:     l.Featured,
		CoverURL:     coverURL(l.Media),
		CreatedAt:    timeOf(l.CreatedAt),
	}
}

// coverURL is the first image by position, or nil.
func coverURL(media []db.ListingMedia) *string {
	for _, m := range media {
		if m.MediaType == "image" {
			u := mediaURL(m.Path)
			return &u
		}
	}
	return nil
}
