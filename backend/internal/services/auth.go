package services

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"brickbot/internal/db"
)

// AuthService checks the single admin's credentials on the profile row.
type AuthService struct {
	q *db.Queries
}

// NewAuthService returns an AuthService backed by q.
func NewAuthService(q *db.Queries) *AuthService {
	return &AuthService{q: q}
}

// dummyHash keeps a failed login as slow as a real one when no profile exists.
var dummyHash = sync.OnceValue(func() []byte {
	h, _ := bcrypt.GenerateFromPassword([]byte("brickbot-dummy-password"), bcrypt.DefaultCost)
	return h
})

// Login checks email and password and returns the password version to bind the
// session to, or ErrUnauthorized. bcrypt always runs so timing does not reveal
// which part was wrong.
func (s *AuthService) Login(ctx context.Context, email, password string) (string, error) {
	c, err := s.q.GetAdminCredentials(ctx)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", fmt.Errorf("get admin credentials: %w", err)
	}
	hash := []byte(c.AdminPasswordHash)
	if len(hash) == 0 {
		hash = dummyHash()
	}
	pwOK := bcrypt.CompareHashAndPassword(hash, []byte(password)) == nil
	if c.AdminEmail == "" && err == nil {
		slog.Warn("login attempted but salesman_profile.admin_email is empty; re-seed to set it")
	}
	emailOK := c.AdminEmail != "" && strings.EqualFold(strings.TrimSpace(email), c.AdminEmail)
	if !pwOK || !emailOK {
		return "", ErrUnauthorized
	}
	return PasswordVersion(c.AdminPasswordHash), nil
}

// SessionEmail confirms pwv matches the current password and returns the admin
// email, or ErrUnauthorized.
func (s *AuthService) SessionEmail(ctx context.Context, pwv string) (string, error) {
	c, err := s.q.GetAdminCredentials(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrUnauthorized
	}
	if err != nil {
		return "", fmt.Errorf("get admin credentials: %w", err)
	}
	if subtle.ConstantTimeCompare([]byte(pwv), []byte(PasswordVersion(c.AdminPasswordHash))) != 1 {
		return "", ErrUnauthorized
	}
	return c.AdminEmail, nil
}

// PasswordVersion is a short fingerprint of the bcrypt hash. It changes when
// the password changes, which invalidates every session cookie.
func PasswordVersion(hash string) string {
	sum := sha256.Sum256([]byte(hash))
	return hex.EncodeToString(sum[:8])
}
