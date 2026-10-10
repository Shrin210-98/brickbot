package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"brickbot/internal/httpx"
	"brickbot/internal/services"
)

// InquiriesHandler serves the public inquiry form and admin triage.
type InquiriesHandler struct {
	svc *services.InquiryService
}

// NewInquiriesHandler returns an InquiriesHandler.
func NewInquiriesHandler(svc *services.InquiryService) *InquiriesHandler {
	return &InquiriesHandler{svc: svc}
}

type createInquiryRequest struct {
	Name        string `json:"name" validate:"required,max=100"`
	Phone       string `json:"phone" validate:"required_without=Email,omitempty,phone"`
	Email       string `json:"email" validate:"required_without=Phone,omitempty,email,max=254"`
	Message     string `json:"message" validate:"max=2000"`
	ListingSlug string `json:"listing_slug" validate:"omitempty,max=120"`
}

type createdInquiryDTO struct {
	ID        string    `json:"id"`
	CreatedAt time.Time `json:"created_at"`
}

type inquiryListingDTO struct {
	ID    string `json:"id"`
	Slug  string `json:"slug"`
	Title string `json:"title"`
}

type inquiryDTO struct {
	ID        string             `json:"id"`
	Listing   *inquiryListingDTO `json:"listing"`
	Name      string             `json:"name"`
	Phone     string             `json:"phone"`
	Email     string             `json:"email"`
	Message   string             `json:"message"`
	Source    string             `json:"source"`
	Status    string             `json:"status"`
	AdminNote string             `json:"admin_note"`
	CreatedAt time.Time          `json:"created_at"`
	UpdatedAt time.Time          `json:"updated_at"`
}

type inquiriesQuery struct {
	Status   string `json:"status" validate:"omitempty,oneof=new contacted closed spam"`
	Page     int64  `json:"page" validate:"min=1,max=10000"`
	PageSize int64  `json:"page_size" validate:"min=1,max=100"`
}

type triageInquiryRequest struct {
	Status    *string `json:"status" validate:"required_without=AdminNote,omitempty,oneof=new contacted closed spam"`
	AdminNote *string `json:"admin_note" validate:"required_without=Status,omitempty,max=5000"`
}

// Create handles POST /api/inquiries.
func (h *InquiriesHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in createInquiryRequest
	if !httpx.DecodeJSON(w, r, &in) {
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	in.Phone = strings.TrimSpace(in.Phone)
	in.Email = strings.TrimSpace(in.Email)
	in.Message = strings.TrimSpace(in.Message)
	in.ListingSlug = strings.TrimSpace(in.ListingSlug)
	if !httpx.Validate(w, in) {
		return
	}
	inq, err := h.svc.Create(r.Context(), services.NewInquiry{
		Name: in.Name, Phone: in.Phone, Email: in.Email, Message: in.Message, ListingSlug: in.ListingSlug,
	})
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, createdInquiryDTO{ID: uuidString(inq.ID), CreatedAt: timeOf(inq.CreatedAt)})
}

// List handles GET /api/admin/inquiries.
func (h *InquiriesHandler) List(w http.ResponseWriter, r *http.Request) {
	qp := httpx.NewQuery(r)
	in := inquiriesQuery{
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
	items := make([]inquiryDTO, len(rows))
	for i, row := range rows {
		items[i] = toInquiry(inquiryRow(row))
	}
	httpx.WriteJSON(w, http.StatusOK, httpx.Page[inquiryDTO]{Items: items, Total: total, Page: in.Page, PageSize: in.PageSize})
}

// Get handles GET /api/admin/inquiries/{id}.
func (h *InquiriesHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	row, err := h.svc.Get(r.Context(), id)
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toInquiry(inquiryRow(row)))
}

// Triage handles PATCH /api/admin/inquiries/{id}.
func (h *InquiriesHandler) Triage(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var in triageInquiryRequest
	if !httpx.DecodeJSON(w, r, &in) || !httpx.Validate(w, in) {
		return
	}
	row, err := h.svc.Triage(r.Context(), id, in.Status, in.AdminNote)
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toInquiry(inquiryRow(row)))
}

// inquiryRow is the shape shared by db.ListInquiriesRow and db.GetInquiryRow,
// which sqlc generates as distinct but identical types.
type inquiryRow struct {
	ID            pgtype.UUID
	ListingID     pgtype.UUID
	Name          string
	Phone         string
	Email         string
	Message       string
	Source        string
	Status        string
	AdminNote     string
	CreatedAt     pgtype.Timestamptz
	UpdatedAt     pgtype.Timestamptz
	ChatSessionID pgtype.UUID
	ListingSlug   *string
	ListingTitle  *string
}

func toInquiry(r inquiryRow) inquiryDTO {
	var listing *inquiryListingDTO
	if r.ListingID.Valid && r.ListingSlug != nil && r.ListingTitle != nil {
		listing = &inquiryListingDTO{ID: uuidString(r.ListingID), Slug: *r.ListingSlug, Title: *r.ListingTitle}
	}
	return inquiryDTO{
		ID:        uuidString(r.ID),
		Listing:   listing,
		Name:      r.Name,
		Phone:     r.Phone,
		Email:     r.Email,
		Message:   r.Message,
		Source:    r.Source,
		Status:    r.Status,
		AdminNote: r.AdminNote,
		CreatedAt: timeOf(r.CreatedAt),
		UpdatedAt: timeOf(r.UpdatedAt),
	}
}
