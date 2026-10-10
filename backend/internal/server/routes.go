// Package server registers every route on the stdlib method-pattern mux.
package server

import (
	"net/http"

	"brickbot/internal/handlers"
)

// Routes returns the API router. Every route is listed in docs/api.md.
func Routes(profile *handlers.ProfileHandler, listings *handlers.ListingsHandler) *http.ServeMux {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/healthz", handlers.Health)
	mux.HandleFunc("GET /api/profile", profile.Get)
	mux.HandleFunc("GET /api/listings", listings.List)
	mux.HandleFunc("GET /api/listings/featured", listings.Featured)
	mux.HandleFunc("GET /api/listings/facets", listings.Facets)
	mux.HandleFunc("GET /api/listings/{slug}", listings.Get)

	return mux
}
