// Package services holds business logic. It never imports net/http; handlers
// map the domain errors below to HTTP statuses.
package services

import "errors"

// Domain errors. Wrap with fmt.Errorf("%w: ...") to add a client-safe message.
var (
	ErrNotFound     = errors.New("not found")
	ErrConflict     = errors.New("conflict")
	ErrInvalid      = errors.New("invalid")
	ErrUnauthorized = errors.New("unauthorized")
)
