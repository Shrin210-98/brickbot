package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestLimiter(t *testing.T) {
	now := time.Unix(0, 0)
	l := NewLimiter(5, time.Minute, 5) // one token per 12s
	l.now = func() time.Time { return now }

	for i := range 5 {
		if ok, _ := l.Allow("a"); !ok {
			t.Fatalf("request %d denied within burst", i+1)
		}
	}
	ok, wait := l.Allow("a")
	if ok || wait != 12*time.Second {
		t.Fatalf("6th request: ok=%v wait=%v, want denied with 12s", ok, wait)
	}
	if ok, _ := l.Allow("b"); !ok {
		t.Fatal("other key should have its own bucket")
	}

	now = now.Add(12 * time.Second)
	if ok, _ := l.Allow("a"); !ok {
		t.Fatal("token should have refilled after 12s")
	}

	now = now.Add(10 * time.Minute)
	l.Allow("c") // triggers a sweep
	if _, ok := l.buckets["a"]; ok {
		t.Fatal("idle full bucket should have been swept")
	}
}

func TestClientIP(t *testing.T) {
	tests := []struct {
		name       string
		remote     string
		xff        string
		trustProxy bool
		want       string
	}{
		{name: "peer", remote: "192.0.2.1:5555", want: "192.0.2.1"},
		{name: "xff ignored without trust", remote: "192.0.2.1:5555", xff: "203.0.113.9", want: "192.0.2.1"},
		{name: "last xff hop with trust", remote: "10.0.0.2:5555", xff: "1.1.1.1, 203.0.113.9", trustProxy: true, want: "203.0.113.9"},
		{name: "no xff with trust", remote: "10.0.0.2:5555", trustProxy: true, want: "10.0.0.2"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			r.RemoteAddr = tt.remote
			if tt.xff != "" {
				r.Header.Set("X-Forwarded-For", tt.xff)
			}
			if got := ClientIP(r, tt.trustProxy); got != tt.want {
				t.Fatalf("ClientIP = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestOrigin(t *testing.T) {
	h := Origin("http://localhost:5173")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	tests := []struct {
		method, origin string
		want           int
	}{
		{http.MethodPost, "", http.StatusNoContent},
		{http.MethodPost, "http://localhost:5173", http.StatusNoContent},
		{http.MethodPost, "https://evil.example", http.StatusForbidden},
		{http.MethodDelete, "https://evil.example", http.StatusForbidden},
		{http.MethodGet, "https://evil.example", http.StatusNoContent},
	}
	for _, tt := range tests {
		r := httptest.NewRequest(tt.method, "/api/x", nil)
		if tt.origin != "" {
			r.Header.Set("Origin", tt.origin)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, r)
		if rec.Code != tt.want {
			t.Errorf("%s Origin=%q: status %d, want %d", tt.method, tt.origin, rec.Code, tt.want)
		}
	}
}
