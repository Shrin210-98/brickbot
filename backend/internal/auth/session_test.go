package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestSessionRoundTrip(t *testing.T) {
	secret := []byte(strings.Repeat("k", 32))
	now := time.Unix(1_800_000_000, 0)

	tests := []struct {
		name    string
		mutate  func(token string) string
		advance time.Duration
		key     []byte
		wantOK  bool
	}{
		{name: "valid", wantOK: true},
		{name: "expired", advance: TTL + time.Second},
		{name: "just before expiry", advance: TTL - time.Second, wantOK: true},
		{name: "wrong key", key: []byte(strings.Repeat("x", 32))},
		{name: "tampered payload", mutate: func(s string) string { return "A" + s[1:] }},
		{name: "tampered mac", mutate: func(s string) string { return s[:len(s)-1] + flip(s[len(s)-1]) }},
		{name: "no separator", mutate: func(s string) string { return strings.ReplaceAll(s, ".", "") }},
		{name: "empty", mutate: func(string) string { return "" }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			issuer := NewSessions(secret, false)
			issuer.now = func() time.Time { return now }
			rec := httptest.NewRecorder()
			issuer.Issue(rec, "pwv123")
			c := rec.Result().Cookies()[0]
			if !c.HttpOnly || c.SameSite != http.SameSiteLaxMode || c.Path != "/api" {
				t.Fatalf("cookie attributes = %+v", c)
			}
			if tt.mutate != nil {
				c.Value = tt.mutate(c.Value)
			}

			key := secret
			if tt.key != nil {
				key = tt.key
			}
			reader := NewSessions(key, false)
			reader.now = func() time.Time { return now.Add(tt.advance) }
			req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
			req.AddCookie(c)

			pwv, ok := reader.Read(req)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if ok && pwv != "pwv123" {
				t.Fatalf("pwv = %q", pwv)
			}
		})
	}
}

func TestClearExpiresCookie(t *testing.T) {
	rec := httptest.NewRecorder()
	NewSessions([]byte(strings.Repeat("k", 32)), true).Clear(rec)
	c := rec.Result().Cookies()[0]
	if c.MaxAge >= 0 || c.Value != "" || !c.Secure {
		t.Fatalf("cleared cookie = %+v", c)
	}
}

func flip(b byte) string {
	if b == 'A' {
		return "B"
	}
	return "A"
}
