package handlers_test

// End-to-end tests through server.Routes against the brickbot_test database
// (make test sets DATABASE_URL). They truncate every table, so DB-backed tests
// live only in this package and never run in parallel.

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"brickbot/internal/auth"
	"brickbot/internal/db"
	"brickbot/internal/handlers"
	"brickbot/internal/server"
	"brickbot/internal/services"
)

const (
	adminEmail    = "admin@example.com"
	adminPassword = "correct horse battery"
	appOrigin     = "http://localhost:5173"
)

type env struct {
	t         *testing.T
	h         http.Handler
	q         *db.Queries
	uploadDir string
}

func newEnv(t *testing.T) *env {
	t.Helper()
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if _, err := pool.Exec(ctx, "TRUNCATE inquiries, listing_media, listings, salesman_profile"); err != nil {
		t.Fatal(err)
	}
	hash, _ := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.MinCost)
	q := db.New(pool)
	if err := q.CreateProfileIfMissing(ctx, db.CreateProfileIfMissingParams{
		Name: "Test", Phone: "+910000000000", ServiceAreas: []string{}, AdminEmail: adminEmail, AdminPasswordHash: string(hash),
	}); err != nil {
		t.Fatal(err)
	}

	uploadDir := t.TempDir()
	authSvc := services.NewAuthService(q)
	sessions := auth.NewSessions([]byte(strings.Repeat("t", 32)), false)
	h := server.Routes(server.Handlers{
		Profile:       handlers.NewProfileHandler(services.NewProfileService(q)),
		Listings:      handlers.NewListingsHandler(services.NewListingService(q)),
		Auth:          handlers.NewAuthHandler(authSvc, sessions),
		Inquiries:     handlers.NewInquiriesHandler(services.NewInquiryService(q)),
		AdminListings: handlers.NewAdminListingsHandler(services.NewAdminListingService(q), services.NewMediaService(q, uploadDir)),
		Media:         handlers.NewMediaHandler(uploadDir),
	}, server.Security{AppOrigin: appOrigin, Sessions: sessions, Checker: authSvc})
	return &env{t: t, h: h, q: q, uploadDir: uploadDir}
}

type req struct {
	method, path string
	body         any // JSON-encoded unless it is *bytes.Buffer
	contentType  string
	cookie       *http.Cookie
	origin       string
	remote       string
}

func (e *env) do(r req) *httptest.ResponseRecorder {
	e.t.Helper()
	var body *bytes.Buffer
	switch b := r.body.(type) {
	case nil:
		body = &bytes.Buffer{}
	case *bytes.Buffer:
		body = b
	default:
		body = &bytes.Buffer{}
		if err := json.NewEncoder(body).Encode(b); err != nil {
			e.t.Fatal(err)
		}
		r.contentType = "application/json"
	}
	hr := httptest.NewRequest(r.method, r.path, body)
	if r.contentType != "" {
		hr.Header.Set("Content-Type", r.contentType)
	}
	if r.cookie != nil {
		hr.AddCookie(r.cookie)
	}
	if r.origin != "" {
		hr.Header.Set("Origin", r.origin)
	}
	if r.remote != "" {
		hr.RemoteAddr = r.remote
	}
	rec := httptest.NewRecorder()
	e.h.ServeHTTP(rec, hr)
	return rec
}

func (e *env) login() *http.Cookie {
	e.t.Helper()
	rec := e.do(req{method: "POST", path: "/api/auth/login", body: map[string]string{"email": adminEmail, "password": adminPassword}})
	if rec.Code != http.StatusNoContent {
		e.t.Fatalf("login: %d %s", rec.Code, rec.Body)
	}
	for _, c := range rec.Result().Cookies() {
		if c.Name == auth.CookieName {
			return c
		}
	}
	e.t.Fatal("login set no session cookie")
	return nil
}

func expect(t *testing.T, rec *httptest.ResponseRecorder, status int) map[string]any {
	t.Helper()
	if rec.Code != status {
		t.Fatalf("status %d, want %d: %s", rec.Code, status, rec.Body)
	}
	out := map[string]any{}
	if rec.Body.Len() > 0 && strings.HasPrefix(rec.Header().Get("Content-Type"), "application/json") {
		if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
			t.Fatalf("decode body: %v", err)
		}
	}
	return out
}

func errFields(body map[string]any) map[string]any {
	e, _ := body["error"].(map[string]any)
	f, _ := e["fields"].(map[string]any)
	return f
}

func TestAdminRoutesRequireCookie(t *testing.T) {
	e := newEnv(t)
	const id = "00000000-0000-0000-0000-000000000001"
	routes := []struct{ method, path string }{
		{"GET", "/api/auth/me"},
		{"GET", "/api/admin/listings"},
		{"POST", "/api/admin/listings"},
		{"GET", "/api/admin/listings/" + id},
		{"PUT", "/api/admin/listings/" + id},
		{"DELETE", "/api/admin/listings/" + id},
		{"POST", "/api/admin/listings/" + id + "/media"},
		{"PATCH", "/api/admin/listings/" + id + "/media/order"},
		{"PUT", "/api/admin/listings/" + id + "/media/" + id},
		{"DELETE", "/api/admin/listings/" + id + "/media/" + id},
		{"GET", "/api/admin/inquiries"},
		{"GET", "/api/admin/inquiries/" + id},
		{"PATCH", "/api/admin/inquiries/" + id},
		{"GET", "/api/admin/does-not-exist"},
	}
	forged := &http.Cookie{Name: auth.CookieName, Value: "djEuOTk5OTk5OTk5OS5hYmM.AAAA"}
	for _, rt := range routes {
		for _, c := range []*http.Cookie{nil, forged} {
			rec := e.do(req{method: rt.method, path: rt.path, cookie: c})
			if rec.Code != http.StatusUnauthorized {
				t.Errorf("%s %s (cookie=%v): status %d, want 401", rt.method, rt.path, c != nil, rec.Code)
			}
		}
	}
}

func TestLoginLogoutMe(t *testing.T) {
	e := newEnv(t)
	bad := []map[string]string{
		{"email": adminEmail, "password": "wrong password"},
		{"email": "other@example.com", "password": adminPassword},
	}
	for _, b := range bad {
		expect(t, e.do(req{method: "POST", path: "/api/auth/login", body: b}), http.StatusUnauthorized)
	}
	expect(t, e.do(req{method: "POST", path: "/api/auth/login", body: map[string]string{"email": "nope"}}), http.StatusUnprocessableEntity)
	expect(t, e.do(req{method: "POST", path: "/api/auth/login", body: map[string]string{"email": adminEmail, "password": adminPassword, "extra": "x"}}), http.StatusBadRequest)

	c := e.login()
	if body := expect(t, e.do(req{method: "GET", path: "/api/auth/me", cookie: c}), http.StatusOK); body["email"] != adminEmail {
		t.Fatalf("me = %v", body)
	}
	rec := e.do(req{method: "POST", path: "/api/auth/logout", cookie: c})
	expect(t, rec, http.StatusNoContent)
	if got := rec.Result().Cookies(); len(got) != 1 || got[0].MaxAge >= 0 {
		t.Fatalf("logout cookies = %+v", got)
	}

	// Changing the password invalidates existing sessions.
	hash, _ := bcrypt.GenerateFromPassword([]byte("a new password"), bcrypt.MinCost)
	if err := e.q.UpdateAdminPasswordHash(context.Background(), string(hash)); err != nil {
		t.Fatal(err)
	}
	expect(t, e.do(req{method: "GET", path: "/api/auth/me", cookie: c}), http.StatusUnauthorized)
}

func TestLoginRateLimited(t *testing.T) {
	e := newEnv(t)
	body := map[string]string{"email": adminEmail, "password": "wrong password"}
	for range 5 {
		expect(t, e.do(req{method: "POST", path: "/api/auth/login", body: body}), http.StatusUnauthorized)
	}
	rec := e.do(req{method: "POST", path: "/api/auth/login", body: body})
	expect(t, rec, http.StatusTooManyRequests)
	if rec.Header().Get("Retry-After") == "" {
		t.Fatal("missing Retry-After")
	}
}

func TestCreateInquiry(t *testing.T) {
	e := newEnv(t)
	c := e.login()
	active := createListing(t, e, c, map[string]any{"status": "active"})
	draft := createListing(t, e, c, map[string]any{"status": "draft"})

	tests := []struct {
		name       string
		body       map[string]any
		want       int
		wantFields []string
	}{
		{"no contact", map[string]any{"name": "A"}, 422, []string{"phone", "email"}},
		{"no name", map[string]any{"email": "a@example.com"}, 422, []string{"name"}},
		{"bad email", map[string]any{"name": "A", "email": "nope"}, 422, []string{"email"}},
		{"bad phone", map[string]any{"name": "A", "phone": "abc"}, 422, []string{"phone"}},
		{"email only", map[string]any{"name": "A", "email": "a@example.com"}, 201, nil},
		{"phone only", map[string]any{"name": "B", "phone": "+91 98765 43210"}, 201, nil},
		{"unknown listing", map[string]any{"name": "C", "email": "c@example.com", "listing_slug": "nope"}, 404, nil},
		{"draft listing", map[string]any{"name": "D", "email": "d@example.com", "listing_slug": draft["slug"]}, 404, nil},
		{"active listing", map[string]any{"name": "E", "email": "e@example.com", "listing_slug": active["slug"]}, 201, nil},
	}
	for i, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// A distinct IP per case keeps the inquiry rate limit out of the way.
			remote := "192.0.2." + string(rune('1'+i)) + ":1000"
			body := expect(t, e.do(req{method: "POST", path: "/api/inquiries", body: tt.body, remote: remote}), tt.want)
			for _, f := range tt.wantFields {
				if _, ok := errFields(body)[f]; !ok {
					t.Errorf("missing field error %q in %v", f, body)
				}
			}
		})
	}

	list := expect(t, e.do(req{method: "GET", path: "/api/admin/inquiries", cookie: c}), http.StatusOK)
	if list["total"] != float64(3) {
		t.Fatalf("total = %v, want 3", list["total"])
	}
	newest := list["items"].([]any)[0].(map[string]any)
	if l, _ := newest["listing"].(map[string]any); l["slug"] != active["slug"] || newest["status"] != "new" || newest["source"] != "form" {
		t.Fatalf("newest inquiry = %v", newest)
	}
}

func TestInquiryRateLimitAndOrigin(t *testing.T) {
	e := newEnv(t)
	body := map[string]any{"name": "A", "email": "a@example.com"}
	expect(t, e.do(req{method: "POST", path: "/api/inquiries", body: body, origin: "https://evil.example"}), http.StatusForbidden)
	for range 5 {
		expect(t, e.do(req{method: "POST", path: "/api/inquiries", body: body, origin: appOrigin}), http.StatusCreated)
	}
	expect(t, e.do(req{method: "POST", path: "/api/inquiries", body: body}), http.StatusTooManyRequests)
	expect(t, e.do(req{method: "POST", path: "/api/inquiries", body: body, remote: "198.51.100.7:1"}), http.StatusCreated)
}

func TestTriageInquiry(t *testing.T) {
	e := newEnv(t)
	c := e.login()
	created := expect(t, e.do(req{method: "POST", path: "/api/inquiries", body: map[string]any{"name": "A", "phone": "9876543210"}}), http.StatusCreated)
	path := "/api/admin/inquiries/" + created["id"].(string)

	expect(t, e.do(req{method: "PATCH", path: path, cookie: c, body: map[string]any{}}), http.StatusUnprocessableEntity)
	expect(t, e.do(req{method: "PATCH", path: path, cookie: c, body: map[string]any{"status": "bogus"}}), http.StatusUnprocessableEntity)
	expect(t, e.do(req{method: "PATCH", path: path, cookie: c, body: map[string]any{"status": "contacted"}}), http.StatusOK)
	got := expect(t, e.do(req{method: "PATCH", path: path, cookie: c, body: map[string]any{"admin_note": "called back"}}), http.StatusOK)
	if got["status"] != "contacted" || got["admin_note"] != "called back" {
		t.Fatalf("triaged = %v", got)
	}
	filtered := expect(t, e.do(req{method: "GET", path: "/api/admin/inquiries?status=new", cookie: c}), http.StatusOK)
	if filtered["total"] != float64(0) {
		t.Fatalf("status=new total = %v", filtered["total"])
	}
	expect(t, e.do(req{method: "GET", path: "/api/admin/inquiries/00000000-0000-0000-0000-000000000000", cookie: c}), http.StatusNotFound)
	expect(t, e.do(req{method: "GET", path: "/api/admin/inquiries/not-a-uuid", cookie: c}), http.StatusNotFound)
}

func createListing(t *testing.T, e *env, c *http.Cookie, overrides map[string]any) map[string]any {
	t.Helper()
	body := map[string]any{
		"title": "2 BHK in Andheri West", "purpose": "sale", "property_type": "apartment",
		"price": 18500000, "bedrooms": 2, "city": "Mumbai", "locality": "Andheri West",
	}
	for k, v := range overrides {
		body[k] = v
	}
	return expect(t, e.do(req{method: "POST", path: "/api/admin/listings", cookie: c, body: body}), http.StatusCreated)
}

func TestAdminListingLifecycle(t *testing.T) {
	e := newEnv(t)
	c := e.login()

	first := createListing(t, e, c, nil)
	if first["slug"] != "2-bhk-in-andheri-west" || first["status"] != "draft" {
		t.Fatalf("created = %v", first)
	}
	second := createListing(t, e, c, nil)
	if second["slug"] != "2-bhk-in-andheri-west-2" {
		t.Fatalf("second slug = %v", second["slug"])
	}
	expect(t, e.do(req{method: "POST", path: "/api/admin/listings", cookie: c, body: map[string]any{
		"slug": "2-bhk-in-andheri-west", "title": "x", "purpose": "sale", "property_type": "plot", "price": 1, "city": "Pune",
	}}), http.StatusConflict)
	bad := expect(t, e.do(req{method: "POST", path: "/api/admin/listings", cookie: c, body: map[string]any{
		"slug": "Bad Slug", "purpose": "lease", "property_type": "plot", "city": "Pune",
	}}), http.StatusUnprocessableEntity)
	for _, f := range []string{"slug", "title", "purpose", "price"} {
		if _, ok := errFields(bad)[f]; !ok {
			t.Errorf("missing field error %q in %v", f, bad)
		}
	}

	id := first["id"].(string)
	slug := first["slug"].(string)
	expect(t, e.do(req{method: "GET", path: "/api/listings/" + slug}), http.StatusNotFound) // draft is not public

	updated := expect(t, e.do(req{method: "PUT", path: "/api/admin/listings/" + id, cookie: c, body: map[string]any{
		"title": "2 BHK, renovated", "purpose": "sale", "property_type": "apartment", "status": "active",
		"price": 19000000, "city": "Mumbai", "featured": true,
	}}), http.StatusOK)
	if updated["slug"] != slug || updated["price"] != float64(19000000) || updated["bedrooms"] != nil {
		t.Fatalf("updated = %v", updated)
	}
	expect(t, e.do(req{method: "GET", path: "/api/listings/" + slug}), http.StatusOK)

	list := expect(t, e.do(req{method: "GET", path: "/api/admin/listings?status=draft", cookie: c}), http.StatusOK)
	if list["total"] != float64(1) {
		t.Fatalf("draft total = %v", list["total"])
	}

	expect(t, e.do(req{method: "DELETE", path: "/api/admin/listings/" + id, cookie: c}), http.StatusNoContent)
	expect(t, e.do(req{method: "DELETE", path: "/api/admin/listings/" + id, cookie: c}), http.StatusNotFound)
	expect(t, e.do(req{method: "GET", path: "/api/admin/listings/" + id, cookie: c}), http.StatusNotFound)
	expect(t, e.do(req{method: "GET", path: "/api/listings/" + slug}), http.StatusNotFound)
	featured := expect(t, e.do(req{method: "GET", path: "/api/listings/featured"}), http.StatusOK)
	if n := len(featured["items"].([]any)); n != 0 {
		t.Fatalf("deleted listing still featured (%d items)", n)
	}
	// A deleted listing keeps its slug reserved.
	if again := createListing(t, e, c, nil); again["slug"] != "2-bhk-in-andheri-west-3" {
		t.Fatalf("slug after delete = %v", again["slug"])
	}
}

var pngHeader = []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR")

func multipartBody(t *testing.T, field string, content []byte) (*bytes.Buffer, string) {
	t.Helper()
	buf := &bytes.Buffer{}
	mw := multipart.NewWriter(buf)
	fw, err := mw.CreateFormFile(field, "photo.png")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = fw.Write(content)
	_ = mw.Close()
	return buf, mw.FormDataContentType()
}

func (e *env) upload(c *http.Cookie, method, path string, content []byte) *httptest.ResponseRecorder {
	e.t.Helper()
	body, ct := multipartBody(e.t, "file", content)
	return e.do(req{method: method, path: path, cookie: c, body: body, contentType: ct})
}

func (e *env) fileFor(url string) string {
	return filepath.Join(e.uploadDir, filepath.FromSlash(strings.TrimPrefix(url, "/media/")))
}

func TestListingMedia(t *testing.T) {
	e := newEnv(t)
	c := e.login()
	l := createListing(t, e, c, map[string]any{"status": "active"})
	base := "/api/admin/listings/" + l["id"].(string) + "/media"

	m1 := expect(t, e.upload(c, "POST", base, pngHeader), http.StatusCreated)
	m2 := expect(t, e.upload(c, "POST", base, pngHeader), http.StatusCreated)
	if m1["position"] != float64(0) || m2["position"] != float64(1) || !strings.HasSuffix(m1["url"].(string), ".png") {
		t.Fatalf("uploads = %v, %v", m1, m2)
	}
	if _, err := os.Stat(e.fileFor(m1["url"].(string))); err != nil {
		t.Fatalf("uploaded file missing: %v", err)
	}
	served := e.do(req{method: "GET", path: m1["url"].(string)})
	expect(t, served, http.StatusOK)
	if !bytes.Equal(served.Body.Bytes(), pngHeader) {
		t.Fatal("served bytes differ from upload")
	}
	expect(t, e.do(req{method: "GET", path: "/media/listings"}), http.StatusNotFound)
	expect(t, e.do(req{method: "GET", path: "/media/nope.png"}), http.StatusNotFound)

	notImage := expect(t, e.upload(c, "POST", base, []byte("hello world")), http.StatusUnprocessableEntity)
	if _, ok := errFields(notImage)["file"]; !ok {
		t.Fatalf("not-image error = %v", notImage)
	}
	expect(t, e.upload(c, "POST", base, append(append([]byte{}, pngHeader...), make([]byte, services.MaxUploadBytes)...)), http.StatusRequestEntityTooLarge)
	expect(t, e.do(req{method: "POST", path: base, cookie: c, body: map[string]any{}}), http.StatusBadRequest)
	expect(t, e.upload(c, "POST", "/api/admin/listings/00000000-0000-0000-0000-000000000000/media", pngHeader), http.StatusNotFound)

	// Replace keeps id and position, swaps the file.
	replaced := expect(t, e.upload(c, "PUT", base+"/"+m1["id"].(string), []byte{0xFF, 0xD8, 0xFF, 0xE0}), http.StatusOK)
	if replaced["id"] != m1["id"] || replaced["position"] != float64(0) || !strings.HasSuffix(replaced["url"].(string), ".jpg") {
		t.Fatalf("replaced = %v", replaced)
	}
	if _, err := os.Stat(e.fileFor(m1["url"].(string))); !os.IsNotExist(err) {
		t.Fatal("old file should be removed after replace")
	}

	// Reorder must name every media item exactly once.
	id1, id2 := m1["id"].(string), m2["id"].(string)
	for _, ids := range [][]string{{id1}, {id1, id1}, {id1, "00000000-0000-0000-0000-000000000000"}} {
		expect(t, e.do(req{method: "PATCH", path: base + "/order", cookie: c, body: map[string]any{"media_ids": ids}}), http.StatusUnprocessableEntity)
	}
	expect(t, e.do(req{method: "PATCH", path: base + "/order", cookie: c, body: map[string]any{"media_ids": []string{id2, id1}}}), http.StatusNoContent)
	detail := expect(t, e.do(req{method: "GET", path: "/api/listings/" + l["slug"].(string)}), http.StatusOK)
	media := detail["media"].([]any)
	if media[0].(map[string]any)["id"] != id2 || detail["cover_url"] != m2["url"] {
		t.Fatalf("after reorder: media=%v cover=%v", media, detail["cover_url"])
	}

	expect(t, e.do(req{method: "DELETE", path: base + "/" + id2, cookie: c}), http.StatusNoContent)
	expect(t, e.do(req{method: "DELETE", path: base + "/" + id2, cookie: c}), http.StatusNotFound)
	if _, err := os.Stat(e.fileFor(m2["url"].(string))); !os.IsNotExist(err) {
		t.Fatal("deleted media file should be removed")
	}
}
