package middleware

import (
	"math"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"brickbot/internal/httpx"
)

// sweepEvery bounds how often idle buckets are evicted.
const sweepEvery = time.Minute

// Limiter is an in-memory token bucket per key (client IP). State is lost on
// restart, which is fine for one process.
type Limiter struct {
	mu        sync.Mutex
	buckets   map[string]*bucket
	perSec    float64
	burst     float64
	lastSweep time.Time
	now       func() time.Time
}

type bucket struct {
	tokens float64
	last   time.Time
}

// NewLimiter allows burst requests at once, refilled at n per every.
func NewLimiter(n int, every time.Duration, burst int) *Limiter {
	return &Limiter{
		buckets: map[string]*bucket{},
		perSec:  float64(n) / every.Seconds(),
		burst:   float64(burst),
		now:     time.Now,
	}
}

// Allow takes one token for key. If none is left it returns false and how long
// until the next token.
func (l *Limiter) Allow(key string) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	l.sweep(now)

	b, ok := l.buckets[key]
	if !ok {
		b = &bucket{tokens: l.burst, last: now}
		l.buckets[key] = b
	}
	b.tokens = math.Min(l.burst, b.tokens+now.Sub(b.last).Seconds()*l.perSec)
	b.last = now
	if b.tokens >= 1 {
		b.tokens--
		return true, 0
	}
	wait := time.Duration((1 - b.tokens) / l.perSec * float64(time.Second))
	return false, wait
}

// sweep drops buckets that have refilled completely, so they hold no state.
func (l *Limiter) sweep(now time.Time) {
	if now.Sub(l.lastSweep) < sweepEvery {
		return
	}
	l.lastSweep = now
	for k, b := range l.buckets {
		if b.tokens+now.Sub(b.last).Seconds()*l.perSec >= l.burst {
			delete(l.buckets, k)
		}
	}
}

// RateLimit answers 429 with Retry-After once a client IP runs out of tokens.
func RateLimit(l *Limiter, trustProxy bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ok, wait := l.Allow(ClientIP(r, trustProxy))
			if !ok {
				w.Header().Set("Retry-After", strconv.Itoa(int(math.Ceil(wait.Seconds()))))
				httpx.Error(w, http.StatusTooManyRequests, httpx.CodeRateLimited, "Too many requests, try again later", nil)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// ClientIP is the peer address, or with trustProxy the last X-Forwarded-For
// entry: the one our own reverse proxy appended, which a client cannot forge.
func ClientIP(r *http.Request, trustProxy bool) string {
	if trustProxy {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			parts := strings.Split(xff, ",")
			if ip := strings.TrimSpace(parts[len(parts)-1]); ip != "" {
				return ip
			}
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
