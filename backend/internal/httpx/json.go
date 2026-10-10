// Package httpx holds HTTP helpers shared by handlers: JSON responses, the error
// envelope, query decoding, validation and pagination.
package httpx

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
)

// Error codes used in the envelope. Status mapping is in docs/api.md.
const (
	CodeBadRequest       = "bad_request"
	CodeUnauthorized     = "unauthorized"
	CodeForbidden        = "forbidden"
	CodeNotFound         = "not_found"
	CodeConflict         = "conflict"
	CodePayloadTooLarge  = "payload_too_large"
	CodeValidationFailed = "validation_failed"
	CodeRateLimited      = "rate_limited"
	CodeInternal         = "internal"
)

// MaxJSONBody caps JSON request bodies.
const MaxJSONBody = 1 << 20

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

// DecodeJSON decodes a single JSON object from the body into v, rejecting
// unknown fields and trailing data. On failure it writes 400 (or 413 over
// MaxJSONBody) and returns false.
func DecodeJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, MaxJSONBody))
	dec.DisallowUnknownFields()
	err := dec.Decode(v)
	if err == nil && dec.Decode(&struct{}{}) != io.EOF {
		err = errors.New("trailing data")
	}
	if err == nil {
		return true
	}
	if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
		Error(w, http.StatusRequestEntityTooLarge, CodePayloadTooLarge, "Request body too large", nil)
		return false
	}
	Error(w, http.StatusBadRequest, CodeBadRequest, "Malformed JSON body", nil)
	return false
}
