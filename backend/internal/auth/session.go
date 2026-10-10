// Package auth issues and verifies the admin session cookie. The cookie is
// stateless: an HMAC-SHA256 signed expiry plus a password version, so changing
// the password invalidates every existing session. There is no sessions table.
package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// CookieName is the admin session cookie.
const CookieName = "bb_session"

// TTL is how long a session lasts. There is no sliding renewal.
const TTL = 7 * 24 * time.Hour

const tokenVersion = "v1"

// Sessions signs and reads the admin session cookie.
type Sessions struct {
	key    []byte
	secure bool
	now    func() time.Time
}

// NewSessions returns Sessions keyed by secret. secure sets the cookie's Secure flag.
func NewSessions(secret []byte, secure bool) *Sessions {
	return &Sessions{key: secret, secure: secure, now: time.Now}
}

// Issue sets a fresh session cookie bound to the password version pwv.
func (s *Sessions) Issue(w http.ResponseWriter, pwv string) {
	exp := s.now().Add(TTL)
	http.SetCookie(w, s.cookie(s.sign(pwv, exp), exp, int(TTL.Seconds())))
}

// Clear expires the session cookie.
func (s *Sessions) Clear(w http.ResponseWriter) {
	http.SetCookie(w, s.cookie("", time.Unix(0, 0), -1))
}

// Read returns the password version from a valid, unexpired cookie on r.
func (s *Sessions) Read(r *http.Request) (pwv string, ok bool) {
	c, err := r.Cookie(CookieName)
	if err != nil {
		return "", false
	}
	return s.verify(c.Value)
}

func (s *Sessions) cookie(value string, exp time.Time, maxAge int) *http.Cookie {
	return &http.Cookie{ // #nosec G124 -- Secure comes from COOKIE_SECURE (dev runs over plain http)
		Name:     CookieName,
		Value:    value,
		Path:     "/api",
		Expires:  exp,
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   s.secure,
		SameSite: http.SameSiteLaxMode,
	}
}

// Token format: base64url("v1.<exp unix>.<pwv>") + "." + base64url(hmac).
func (s *Sessions) sign(pwv string, exp time.Time) string {
	payload := tokenVersion + "." + strconv.FormatInt(exp.Unix(), 10) + "." + pwv
	enc := base64.RawURLEncoding
	return enc.EncodeToString([]byte(payload)) + "." + enc.EncodeToString(s.mac(payload))
}

func (s *Sessions) verify(token string) (string, bool) {
	enc := base64.RawURLEncoding
	p64, m64, ok := strings.Cut(token, ".")
	if !ok {
		return "", false
	}
	payload, err := enc.DecodeString(p64)
	if err != nil {
		return "", false
	}
	mac, err := enc.DecodeString(m64)
	if err != nil || !hmac.Equal(mac, s.mac(string(payload))) {
		return "", false
	}
	parts := strings.SplitN(string(payload), ".", 3)
	if len(parts) != 3 || parts[0] != tokenVersion || parts[2] == "" {
		return "", false
	}
	exp, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil || s.now().Unix() >= exp {
		return "", false
	}
	return parts[2], true
}

func (s *Sessions) mac(payload string) []byte {
	h := hmac.New(sha256.New, s.key)
	h.Write([]byte(payload))
	return h.Sum(nil)
}
