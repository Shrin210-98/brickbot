package handlers

import (
	"errors"
	"io"
	"net/http"
	"uuid"

	"github.com/jackc/pgx/v5/pgtype"

	"brickbot/internal/httpx"
	"brickbot/internal/services"
)

// multipartOverhead is headroom on top of MaxUploadBytes for multipart framing.
const multipartOverhead = 1 << 20

var errFileTooLarge = errors.New("file too large")

// AdminListingsHandler serves listing CRUD and media management for the admin.
type AdminListingsHandler struct {
	svc   *services.AdminListingService
	media *services.MediaService
}

// NewAdminListingsHandler returns an AdminListingsHandler.
func NewAdminListingsHandler(svc *services.AdminListingService, media *services.MediaService) *AdminListingsHandler {
	return &AdminListingsHandler{svc: svc, media: media}
}

type adminListingsQuery struct {
	Status   string `json:"status" validate:"omitempty,oneof=draft active sold rented"`
	Page     int64  `json:"page" validate:"min=1,max=10000"`
	PageSize int64  `json:"page_size" validate:"min=1,max=100"`
}

// listingRequest is the body of POST and PUT /api/admin/listings[/{id}].
type listingRequest struct {
	Slug         string `json:"slug" validate:"omitempty,max=120,slug"`
	Title        string `json:"title" validate:"required,max=200"`
	Description  string `json:"description" validate:"max=10000"`
	Purpose      string `json:"purpose" validate:"required,oneof=sale rent"`
	PropertyType string `json:"property_type" validate:"required,oneof=apartment house villa plot commercial other"`
	Status       string `json:"status" validate:"omitempty,oneof=draft active sold rented"`
	Price        *int64 `json:"price" validate:"required,min=0"`
	Bedrooms     *int16 `json:"bedrooms" validate:"omitempty,min=0,max=50"`
	Bathrooms    *int16 `json:"bathrooms" validate:"omitempty,min=0,max=50"`
	Area         *int32 `json:"area" validate:"omitempty,min=1"`
	City         string `json:"city" validate:"required,max=100"`
	Locality     string `json:"locality" validate:"max=100"`
	Address      string `json:"address" validate:"max=300"`
	Featured     bool   `json:"featured"`
}

type reorderMediaRequest struct {
	MediaIDs []string `json:"media_ids" validate:"required,max=200,dive,uuid"`
}

// List handles GET /api/admin/listings.
func (h *AdminListingsHandler) List(w http.ResponseWriter, r *http.Request) {
	qp := httpx.NewQuery(r)
	in := adminListingsQuery{
		Status:   qp.String("status"),
		Page:     qp.Int64("page", httpx.DefaultPage),
		PageSize: qp.Int64("page_size", httpx.DefaultPageSize),
	}
	if qp.BadRequest(w) || !httpx.Validate(w, in) {
		return
	}
	rows, total, err := h.svc.List(r.Context(), in.Status, in.Page, in.PageSize)
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, httpx.Page[listingSummaryDTO]{
		Items: toSummaries(rows), Total: total, Page: in.Page, PageSize: in.PageSize,
	})
}

// Get handles GET /api/admin/listings/{id}.
func (h *AdminListingsHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	l, err := h.svc.Get(r.Context(), id)
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toDetail(l))
}

// Create handles POST /api/admin/listings.
func (h *AdminListingsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in listingRequest
	if !httpx.DecodeJSON(w, r, &in) || !httpx.Validate(w, in) {
		return
	}
	l, err := h.svc.Create(r.Context(), in.toInput())
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toDetail(l))
}

// Update handles PUT /api/admin/listings/{id}.
func (h *AdminListingsHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var in listingRequest
	if !httpx.DecodeJSON(w, r, &in) || !httpx.Validate(w, in) {
		return
	}
	l, err := h.svc.Update(r.Context(), id, in.toInput())
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toDetail(l))
}

// Delete handles DELETE /api/admin/listings/{id} (soft delete).
func (h *AdminListingsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	if err := h.svc.Delete(r.Context(), id); err != nil {
		writeServiceError(w, r, err)
		return
	}
	httpx.NoContent(w)
}

// AddMedia handles POST /api/admin/listings/{id}/media (multipart, field "file").
func (h *AdminListingsHandler) AddMedia(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	file, ok := uploadedFile(w, r)
	if !ok {
		return
	}
	m, err := h.media.Add(r.Context(), id, file)
	if err != nil {
		writeMediaError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toMedia(m))
}

// ReplaceMedia handles PUT /api/admin/listings/{id}/media/{media_id}.
func (h *AdminListingsHandler) ReplaceMedia(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	mediaID, ok := pathUUID(w, r, "media_id")
	if !ok {
		return
	}
	file, ok := uploadedFile(w, r)
	if !ok {
		return
	}
	m, err := h.media.Replace(r.Context(), id, mediaID, file)
	if err != nil {
		writeMediaError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toMedia(m))
}

// DeleteMedia handles DELETE /api/admin/listings/{id}/media/{media_id}.
func (h *AdminListingsHandler) DeleteMedia(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	mediaID, ok := pathUUID(w, r, "media_id")
	if !ok {
		return
	}
	if err := h.media.Delete(r.Context(), id, mediaID); err != nil {
		writeServiceError(w, r, err)
		return
	}
	httpx.NoContent(w)
}

// ReorderMedia handles PATCH /api/admin/listings/{id}/media/order.
func (h *AdminListingsHandler) ReorderMedia(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var in reorderMediaRequest
	if !httpx.DecodeJSON(w, r, &in) || !httpx.Validate(w, in) {
		return
	}
	ids := make([]pgtype.UUID, len(in.MediaIDs))
	for i, s := range in.MediaIDs {
		ids[i] = pgtype.UUID{Bytes: uuid.MustParse(s), Valid: true} // validated above
	}
	if err := h.media.Reorder(r.Context(), id, ids); err != nil {
		writeMediaError(w, r, err)
		return
	}
	httpx.NoContent(w)
}

func (in listingRequest) toInput() services.ListingInput {
	return services.ListingInput{
		Slug: in.Slug, Title: in.Title, Description: in.Description,
		Purpose: in.Purpose, PropertyType: in.PropertyType, Status: in.Status,
		Price: *in.Price, Bedrooms: in.Bedrooms, Bathrooms: in.Bathrooms, Area: in.Area,
		City: in.City, Locality: in.Locality, Address: in.Address, Featured: in.Featured,
	}
}

// uploadedFile returns a reader over the multipart part named "file", capped
// at MaxUploadBytes. On failure it writes 400 and returns false.
func uploadedFile(w http.ResponseWriter, r *http.Request) (io.Reader, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, services.MaxUploadBytes+multipartOverhead)
	mr, err := r.MultipartReader()
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, httpx.CodeBadRequest, "Expected multipart/form-data with a \"file\" field", nil)
		return nil, false
	}
	for {
		part, err := mr.NextPart()
		if err != nil {
			if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
				tooLarge(w)
				return nil, false
			}
			httpx.Error(w, http.StatusBadRequest, httpx.CodeBadRequest, "Expected multipart/form-data with a \"file\" field", nil)
			return nil, false
		}
		if part.FormName() == "file" {
			return &cappedReader{r: part, left: services.MaxUploadBytes}, true
		}
	}
}

// writeMediaError adds 413 and the 422 media cases on top of writeServiceError.
func writeMediaError(w http.ResponseWriter, r *http.Request, err error) {
	_, overBody := errors.AsType[*http.MaxBytesError](err)
	switch {
	case overBody || errors.Is(err, errFileTooLarge):
		tooLarge(w)
	case errors.Is(err, services.ErrUnsupportedMedia):
		httpx.Error(w, http.StatusUnprocessableEntity, httpx.CodeValidationFailed, "Request validation failed",
			map[string]string{"file": "must be a JPEG, PNG or WebP image"})
	case errors.Is(err, services.ErrMediaSetMismatch):
		httpx.Error(w, http.StatusUnprocessableEntity, httpx.CodeValidationFailed, "Request validation failed",
			map[string]string{"media_ids": "must list every media item of the listing exactly once"})
	default:
		writeServiceError(w, r, err)
	}
}

func tooLarge(w http.ResponseWriter) {
	httpx.Error(w, http.StatusRequestEntityTooLarge, httpx.CodePayloadTooLarge, "File must be at most 10 MB", nil)
}

// cappedReader fails with errFileTooLarge once more than left bytes are read.
type cappedReader struct {
	r    io.Reader
	left int64
}

func (c *cappedReader) Read(p []byte) (int, error) {
	if int64(len(p)) > c.left+1 {
		p = p[:c.left+1]
	}
	n, err := c.r.Read(p)
	c.left -= int64(n)
	if c.left < 0 {
		return n, errFileTooLarge
	}
	return n, err
}
