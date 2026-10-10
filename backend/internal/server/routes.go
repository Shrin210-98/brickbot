// Package server registers every route on the stdlib method-pattern mux.
package server

import (
	"net/http"
	"time"

	"brickbot/internal/auth"
	"brickbot/internal/handlers"
	"brickbot/internal/middleware"
)

// Handlers are the route handlers, built in cmd/api.
type Handlers struct {
	Profile       *handlers.ProfileHandler
	Listings      *handlers.ListingsHandler
	Auth          *handlers.AuthHandler
	Inquiries     *handlers.InquiriesHandler
	AdminListings *handlers.AdminListingsHandler
	Media         *handlers.MediaHandler
}

// Security configures the middleware that guards routes.
type Security struct {
	AppOrigin  string
	TrustProxy bool
	Sessions   *auth.Sessions
	Checker    middleware.SessionChecker
}

// Rate limits per client IP (in memory, per process).
var (
	inquiryRate = rate{n: 5, every: time.Minute, burst: 5}
	loginRate   = rate{n: 5, every: 15 * time.Minute, burst: 5}
)

type rate struct {
	n     int
	every time.Duration
	burst int
}

func (r rate) limit(trustProxy bool) func(http.Handler) http.Handler {
	return middleware.RateLimit(middleware.NewLimiter(r.n, r.every, r.burst), trustProxy)
}

// Routes returns the API handler with the full middleware chain. Every route
// is listed in docs/api.md.
func Routes(h Handlers, sec Security) http.Handler {
	requireAdmin := middleware.RequireAdmin(sec.Sessions, sec.Checker)
	inquiryLimit := inquiryRate.limit(sec.TrustProxy)
	loginLimit := loginRate.limit(sec.TrustProxy)

	mux := http.NewServeMux()

	// public
	mux.HandleFunc("GET /api/healthz", handlers.Health)
	mux.HandleFunc("GET /api/profile", h.Profile.Get)
	mux.HandleFunc("GET /api/listings", h.Listings.List)
	mux.HandleFunc("GET /api/listings/featured", h.Listings.Featured)
	mux.HandleFunc("GET /api/listings/facets", h.Listings.Facets)
	mux.HandleFunc("GET /api/listings/{slug}", h.Listings.Get)
	mux.Handle("POST /api/inquiries", inquiryLimit(http.HandlerFunc(h.Inquiries.Create)))
	mux.HandleFunc("GET /media/{path...}", h.Media.Serve)

	// auth
	mux.Handle("POST /api/auth/login", loginLimit(http.HandlerFunc(h.Auth.Login)))
	mux.HandleFunc("POST /api/auth/logout", h.Auth.Logout)
	mux.Handle("GET /api/auth/me", requireAdmin(http.HandlerFunc(h.Auth.Me)))

	// admin: everything under /api/admin/ is behind RequireAdmin, including
	// unknown paths, so nothing there is reachable without a valid cookie.
	admin := http.NewServeMux()
	admin.HandleFunc("GET /api/admin/listings", h.AdminListings.List)
	admin.HandleFunc("POST /api/admin/listings", h.AdminListings.Create)
	admin.HandleFunc("GET /api/admin/listings/{id}", h.AdminListings.Get)
	admin.HandleFunc("PUT /api/admin/listings/{id}", h.AdminListings.Update)
	admin.HandleFunc("DELETE /api/admin/listings/{id}", h.AdminListings.Delete)
	admin.HandleFunc("POST /api/admin/listings/{id}/media", h.AdminListings.AddMedia)
	admin.HandleFunc("PATCH /api/admin/listings/{id}/media/order", h.AdminListings.ReorderMedia)
	admin.HandleFunc("PUT /api/admin/listings/{id}/media/{media_id}", h.AdminListings.ReplaceMedia)
	admin.HandleFunc("DELETE /api/admin/listings/{id}/media/{media_id}", h.AdminListings.DeleteMedia)
	admin.HandleFunc("GET /api/admin/inquiries", h.Inquiries.List)
	admin.HandleFunc("GET /api/admin/inquiries/{id}", h.Inquiries.Get)
	admin.HandleFunc("PATCH /api/admin/inquiries/{id}", h.Inquiries.Triage)
	mux.Handle("/api/admin/", requireAdmin(admin))

	return middleware.Chain(mux,
		middleware.RequestID,
		middleware.Logger,
		middleware.Recover,
		middleware.Origin(sec.AppOrigin),
	)
}
