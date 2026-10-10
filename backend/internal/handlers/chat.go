package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"
	"uuid"

	"github.com/jackc/pgx/v5/pgtype"

	"brickbot/internal/httpx"
	"brickbot/internal/services"
	"brickbot/internal/services/chat"
)

// ChatHandler serves the chatbot routes. A nil service means the chatbot is
// disabled (no ANTHROPIC_API_KEY) and every route answers 503.
type ChatHandler struct {
	svc *chat.Service
}

// NewChatHandler returns a ChatHandler; svc may be nil.
func NewChatHandler(svc *chat.Service) *ChatHandler {
	return &ChatHandler{svc: svc}
}

type createChatSessionRequest struct {
	VisitorID string `json:"visitor_id" validate:"required,uuid"`
}

type chatSessionDTO struct {
	ID        string    `json:"id"`
	CreatedAt time.Time `json:"created_at"`
}

type sendChatMessageRequest struct {
	VisitorID string `json:"visitor_id" validate:"required,uuid"`
	Content   string `json:"content" validate:"required,max=2000"`
}

type chatLineDTO struct {
	ID        int64     `json:"id"`
	Role      string    `json:"role"`
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"created_at"`
}

type chatErrorDTO struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// CreateSession handles POST /api/chat/sessions.
func (h *ChatHandler) CreateSession(w http.ResponseWriter, r *http.Request) {
	if !h.enabled(w) {
		return
	}
	var in createChatSessionRequest
	if !httpx.DecodeJSON(w, r, &in) || !httpx.Validate(w, in) {
		return
	}
	sess, err := h.svc.CreateSession(r.Context(), mustUUID(in.VisitorID))
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, chatSessionDTO{ID: uuidString(sess.ID), CreatedAt: timeOf(sess.CreatedAt)})
}

// Messages handles GET /api/chat/sessions/{id}/messages?visitor_id=….
func (h *ChatHandler) Messages(w http.ResponseWriter, r *http.Request) {
	if !h.enabled(w) {
		return
	}
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	visitor, err := uuid.Parse(r.URL.Query().Get("visitor_id"))
	if err != nil {
		// Same answer as a wrong visitor, so a session id reveals nothing.
		httpx.Error(w, http.StatusNotFound, httpx.CodeNotFound, "Not found", nil)
		return
	}
	lines, err := h.svc.Transcript(r.Context(), id, pgtype.UUID{Bytes: visitor, Valid: true})
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	items := make([]chatLineDTO, len(lines))
	for i, l := range lines {
		items[i] = chatLineDTO{ID: l.ID, Role: l.Role, Text: l.Text, CreatedAt: timeOf(l.CreatedAt)}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string][]chatLineDTO{"items": items})
}

// Send handles POST /api/chat/sessions/{id}/messages: it validates and locks
// the session (JSON errors), then streams the reply as SSE (docs/chatbot.md).
func (h *ChatHandler) Send(w http.ResponseWriter, r *http.Request) {
	if !h.enabled(w) {
		return
	}
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var in sendChatMessageRequest
	if !httpx.DecodeJSON(w, r, &in) {
		return
	}
	in.Content = strings.TrimSpace(in.Content)
	if !httpx.Validate(w, in) {
		return
	}
	unlock, err := h.svc.Lock(r.Context(), id, mustUUID(in.VisitorID))
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	defer unlock()

	sse := httpx.NewSSE(w)
	if err := h.svc.Reply(r.Context(), id, in.Content, &sseSink{sse: sse}); err != nil {
		code, msg := "internal", "Something went wrong. Please try again."
		if errors.Is(err, chat.ErrUpstream) {
			code, msg = "upstream", "The assistant is unavailable right now. Please try again."
		}
		slog.Error("chat reply", "session", uuidString(id), "code", code, "err", err)
		_ = sse.Send("error", chatErrorDTO{Code: code, Message: msg})
		return
	}
	_ = sse.Send("done", struct{}{})
}

func (h *ChatHandler) enabled(w http.ResponseWriter) bool {
	if h.svc == nil {
		httpx.Error(w, http.StatusServiceUnavailable, httpx.CodeUnavailable, "Chat is not available", nil)
		return false
	}
	return true
}

// mustUUID parses an id that already passed the `uuid` validation tag.
func mustUUID(s string) pgtype.UUID {
	u, err := uuid.Parse(s)
	return pgtype.UUID{Bytes: u, Valid: err == nil}
}

// sseSink maps chat.Sink calls to SSE events. Write errors mean the client is
// gone; the request context is then cancelled and the turn stops on its own.
type sseSink struct {
	sse *httpx.SSE
}

func (s *sseSink) Delta(text string) { _ = s.sse.Send("delta", map[string]string{"text": text}) }

func (s *sseSink) Tool(name string) { _ = s.sse.Send("tool", map[string]string{"name": name}) }

func (s *sseSink) Listings(items []services.ListingWithMedia) {
	_ = s.sse.Send("listings", map[string][]listingSummaryDTO{"items": toSummaries(items)})
}

func (s *sseSink) LeadCreated(id pgtype.UUID) {
	_ = s.sse.Send("lead_created", map[string]string{"inquiry_id": uuidString(id)})
}
