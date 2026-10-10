package handlers

import (
	"net/http"

	"brickbot/internal/auth"
	"brickbot/internal/httpx"
	"brickbot/internal/middleware"
	"brickbot/internal/services"
)

// AuthHandler logs the admin in and out.
type AuthHandler struct {
	svc      *services.AuthService
	sessions *auth.Sessions
}

// NewAuthHandler returns an AuthHandler.
func NewAuthHandler(svc *services.AuthService, sessions *auth.Sessions) *AuthHandler {
	return &AuthHandler{svc: svc, sessions: sessions}
}

type loginRequest struct {
	Email    string `json:"email" validate:"required,email,max=254"`
	Password string `json:"password" validate:"required,max=200"`
}

type meDTO struct {
	Email string `json:"email"`
}

// Login handles POST /api/auth/login.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var in loginRequest
	if !httpx.DecodeJSON(w, r, &in) || !httpx.Validate(w, in) {
		return
	}
	pwv, err := h.svc.Login(r.Context(), in.Email, in.Password)
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	h.sessions.Issue(w, pwv)
	httpx.NoContent(w)
}

// Logout handles POST /api/auth/logout. It always succeeds.
func (h *AuthHandler) Logout(w http.ResponseWriter, _ *http.Request) {
	h.sessions.Clear(w)
	httpx.NoContent(w)
}

// Me handles GET /api/auth/me (behind RequireAdmin).
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, meDTO{Email: middleware.AdminEmail(r.Context())})
}
