// Package httpx holds HTTP helpers shared by handlers: JSON responses, the error
// envelope, query decoding, validation and pagination.
package httpx

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// Error codes used in the envelope. Status mapping is in docs/api.md.
const (
	CodeBadRequest       = "bad_request"
	CodeNotFound         = "not_found"
	CodeConflict         = "conflict"
	CodeValidationFailed = "validation_failed"
	CodeInternal         = "internal"
)

// WriteJSON writes v as JSON with the given status.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("write json", "err", err)
	}
}

type errorBody struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

// Error writes the error envelope {"error":{"code","message","fields?"}}.
func Error(w http.ResponseWriter, status int, code, message string, fields map[string]string) {
	WriteJSON(w, status, map[string]errorBody{"error": {Code: code, Message: message, Fields: fields}})
}

// InternalError logs err and writes a generic 500 so internals never leak to clients.
func InternalError(w http.ResponseWriter, r *http.Request, err error) {
	slog.Error("internal error", "method", r.Method, "path", r.URL.Path, "err", err)
	Error(w, http.StatusInternalServerError, CodeInternal, "Internal server error", nil)
}
