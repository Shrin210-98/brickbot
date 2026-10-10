// Package handlers decodes requests, validates them, calls services and maps
// results to response DTOs. sqlc structs never leave this package.
package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
	"uuid"

	"github.com/jackc/pgx/v5/pgtype"

	"brickbot/internal/httpx"
	"brickbot/internal/services"
)

// writeServiceError maps domain errors to statuses; anything else is a 500.
func writeServiceError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, services.ErrUnauthorized):
		httpx.Error(w, http.StatusUnauthorized, httpx.CodeUnauthorized, "Login required", nil)
	case errors.Is(err, services.ErrNotFound):
		httpx.Error(w, http.StatusNotFound, httpx.CodeNotFound, "Not found", nil)
	case errors.Is(err, services.ErrConflict):
		httpx.Error(w, http.StatusConflict, httpx.CodeConflict, clientMessage(err, services.ErrConflict), nil)
	case errors.Is(err, services.ErrInvalid):
		httpx.Error(w, http.StatusBadRequest, httpx.CodeBadRequest, clientMessage(err, services.ErrInvalid), nil)
	default:
		httpx.InternalError(w, r, err)
	}
}

// clientMessage strips the "<sentinel>: " prefix from a wrapped domain error.
func clientMessage(err, sentinel error) string {
	msg, ok := strings.CutPrefix(err.Error(), sentinel.Error()+": ")
	if !ok || msg == "" {
		return "Request rejected"
	}
	return msg
}

// mediaURL maps a stored path (relative to /media/) to a public URL.
func mediaURL(path string) string { return "/media/" + path }

func uuidString(u pgtype.UUID) string {
	b := u.Bytes
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// pathUUID parses the {name} path value. A malformed id writes 404, since no
// resource can have it, and returns false.
func pathUUID(w http.ResponseWriter, r *http.Request, name string) (pgtype.UUID, bool) {
	u, err := uuid.Parse(r.PathValue(name))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, httpx.CodeNotFound, "Not found", nil)
		return pgtype.UUID{}, false
	}
	return pgtype.UUID{Bytes: u, Valid: true}, true
}

func timeOf(t pgtype.Timestamptz) time.Time { return t.Time }
