// Package middleware holds the HTTP middleware chain:
// RequestID → Logger → Recover → Origin check → RequireAdmin → RateLimit → handler.
package middleware

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"brickbot/internal/auth"
	"brickbot/internal/httpx"
	"brickbot/internal/services"
)

type ctxKey int

const (
	requestIDKey ctxKey = iota
	adminEmailKey
)

// Chain applies mws so the first one is outermost.
func Chain(h http.Handler, mws ...func(http.Handler) http.Handler) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}

// RequestID sets X-Request-ID on the response and stores it in the context.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b := make([]byte, 8)
		_, _ = rand.Read(b)
		id := hex.EncodeToString(b)
		w.Header().Set("X-Request-ID", id)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), requestIDKey, id)))
	})
}

// Logger logs one line per request.
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		id, _ := r.Context().Value(requestIDKey).(string)
		slog.Info("request", "method", r.Method, "path", r.URL.Path, "status", rec.status,
			"dur_ms", time.Since(start).Milliseconds(), "request_id", id)
	})
}

// Recover turns a panic into a logged 500.
func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				if v == http.ErrAbortHandler { //nolint:errorlint // sentinel re-panic per net/http docs
					panic(v)
				}
				slog.Error("panic", "method", r.Method, "path", r.URL.Path, "panic", v)
				httpx.Error(w, http.StatusInternalServerError, httpx.CodeInternal, "Internal server error", nil)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// Origin rejects state-changing requests whose Origin header is set and is not
// allowed. Requests without an Origin header (curl, tests) pass.
func Origin(allowed string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.Method {
			case http.MethodGet, http.MethodHead, http.MethodOptions:
			default:
				if o := r.Header.Get("Origin"); o != "" && o != allowed {
					httpx.Error(w, http.StatusForbidden, httpx.CodeForbidden, "Origin not allowed", nil)
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// SessionChecker confirms a cookie's password version is still current and
// returns the admin email. services.AuthService implements it.
type SessionChecker interface {
	SessionEmail(ctx context.Context, pwv string) (string, error)
}

// RequireAdmin rejects requests without a valid admin session cookie with 401.
func RequireAdmin(sessions *auth.Sessions, checker SessionChecker) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			pwv, ok := sessions.Read(r)
			if !ok {
				unauthorized(w)
				return
			}
			email, err := checker.SessionEmail(r.Context(), pwv)
			if errors.Is(err, services.ErrUnauthorized) {
				unauthorized(w)
				return
			}
			if err != nil {
				httpx.InternalError(w, r, err)
				return
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), adminEmailKey, email)))
		})
	}
}

// AdminEmail returns the logged-in admin's email set by RequireAdmin.
func AdminEmail(ctx context.Context) string {
	s, _ := ctx.Value(adminEmailKey).(string)
	return s
}

func unauthorized(w http.ResponseWriter) {
	httpx.Error(w, http.StatusUnauthorized, httpx.CodeUnauthorized, "Login required", nil)
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// Unwrap lets http.ResponseController reach the underlying writer (SSE flush, deadlines).
func (r *statusRecorder) Unwrap() http.ResponseWriter { return r.ResponseWriter }
