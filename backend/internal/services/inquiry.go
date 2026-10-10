package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"brickbot/internal/db"
)

// InquiryService stores leads from the public form and lets the admin triage them.
type InquiryService struct {
	q *db.Queries
}

// NewInquiryService returns an InquiryService backed by q.
func NewInquiryService(q *db.Queries) *InquiryService {
	return &InquiryService{q: q}
}

// NewInquiry is a visitor's inquiry. At least one of Phone and Email is set;
// ListingSlug is optional.
type NewInquiry struct {
	Name        string
	Phone       string
	Email       string
	Message     string
	ListingSlug string
}

// Create stores a form inquiry. A non-empty ListingSlug must name an active
// listing, or ErrNotFound.
func (s *InquiryService) Create(ctx context.Context, in NewInquiry) (db.Inquiry, error) {
	return s.create(ctx, in, "form", pgtype.UUID{})
}

// CreateFromChat stores a chatbot lead for a chat session. A session has at
// most one lead; a second one is ErrConflict.
func (s *InquiryService) CreateFromChat(ctx context.Context, sessionID pgtype.UUID, in NewInquiry) (db.Inquiry, error) {
	return s.create(ctx, in, "chat", sessionID)
}

func (s *InquiryService) create(ctx context.Context, in NewInquiry, source string, chatSessionID pgtype.UUID) (db.Inquiry, error) {
	if in.Phone == "" && in.Email == "" {
		return db.Inquiry{}, fmt.Errorf("%w: phone or email is required", ErrInvalid)
	}
	var listingID pgtype.UUID
	if in.ListingSlug != "" {
		l, err := s.q.GetActiveListingBySlug(ctx, in.ListingSlug)
		if errors.Is(err, pgx.ErrNoRows) {
			return db.Inquiry{}, fmt.Errorf("%w: listing", ErrNotFound)
		}
		if err != nil {
			return db.Inquiry{}, fmt.Errorf("get listing: %w", err)
		}
		listingID = l.ID
	}
	inq, err := s.q.CreateInquiry(ctx, db.CreateInquiryParams{
		ListingID:     listingID,
		Name:          in.Name,
		Phone:         in.Phone,
		Email:         in.Email,
		Message:       in.Message,
		Source:        source,
		ChatSessionID: chatSessionID,
	})
	if isUniqueViolation(err) {
		return db.Inquiry{}, fmt.Errorf("%w: a lead was already recorded for this conversation", ErrConflict)
	}
	if err != nil {
		return db.Inquiry{}, fmt.Errorf("create inquiry: %w", err)
	}
	return inq, nil
}

// List returns one page of inquiries, newest first, optionally by status.
func (s *InquiryService) List(ctx context.Context, status string, page, pageSize int64) ([]db.ListInquiriesRow, int64, error) {
	total, err := s.q.CountInquiries(ctx, optString(status))
	if err != nil {
		return nil, 0, fmt.Errorf("count inquiries: %w", err)
	}
	rows, err := s.q.ListInquiries(ctx, db.ListInquiriesParams{
		Status: optString(status),
		Limit:  pageSize,
		Offset: (page - 1) * pageSize,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("list inquiries: %w", err)
	}
	return rows, total, nil
}

// Get returns one inquiry, or ErrNotFound.
func (s *InquiryService) Get(ctx context.Context, id pgtype.UUID) (db.GetInquiryRow, error) {
	row, err := s.q.GetInquiry(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.GetInquiryRow{}, fmt.Errorf("%w: inquiry", ErrNotFound)
	}
	if err != nil {
		return db.GetInquiryRow{}, fmt.Errorf("get inquiry: %w", err)
	}
	return row, nil
}

// Triage updates status and/or admin note (nil leaves a field unchanged) and
// returns the updated inquiry.
func (s *InquiryService) Triage(ctx context.Context, id pgtype.UUID, status, adminNote *string) (db.GetInquiryRow, error) {
	n, err := s.q.UpdateInquiry(ctx, db.UpdateInquiryParams{ID: id, Status: status, AdminNote: adminNote})
	if err != nil {
		return db.GetInquiryRow{}, fmt.Errorf("update inquiry: %w", err)
	}
	if n == 0 {
		return db.GetInquiryRow{}, fmt.Errorf("%w: inquiry", ErrNotFound)
	}
	return s.Get(ctx, id)
}
