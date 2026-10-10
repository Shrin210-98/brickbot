package httpx

import (
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

// Query decodes URL query params, collecting parse errors per key so the
// handler can report them all at once with BadRequest.
type Query struct {
	values url.Values
	errs   map[string]string
}

// NewQuery wraps the request's query string.
func NewQuery(r *http.Request) *Query {
	return &Query{values: r.URL.Query(), errs: map[string]string{}}
}

// String returns the trimmed value of key, or "" if absent.
func (q *Query) String(key string) string {
	return strings.TrimSpace(q.values.Get(key))
}

// Int64 returns key as an int64, or def if absent or empty.
func (q *Query) Int64(key string, def int64) int64 {
	if p := q.OptInt64(key); p != nil {
		return *p
	}
	return def
}

// OptInt64 returns key as an *int64, or nil if absent or empty.
func (q *Query) OptInt64(key string) *int64 {
	s := q.String(key)
	if s == "" {
		return nil
	}
	n, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		q.errs[key] = "must be an integer"
		return nil
	}
	return &n
}

// BadRequest writes a 400 listing every unparsable param and returns true,
// or returns false if all params parsed.
func (q *Query) BadRequest(w http.ResponseWriter) bool {
	if len(q.errs) == 0 {
		return false
	}
	Error(w, http.StatusBadRequest, CodeBadRequest, "Malformed query parameters", q.errs)
	return true
}
