package handlers_test

import (
	"context"
	"testing"
)

func TestListTestimonials(t *testing.T) {
	e := newEnv(t)

	body := expect(t, e.do(req{method: "GET", path: "/api/testimonials"}), 200)
	if items, ok := body["items"].([]any); !ok || len(items) != 0 {
		t.Fatalf("empty items = %v", body["items"])
	}

	c := e.login()
	active := createListing(t, e, c, map[string]any{"title": "Active flat", "status": "active"})
	draft := createListing(t, e, c, map[string]any{"title": "Draft flat", "status": "draft"})

	// No write route yet; testimonials are inserted directly.
	ctx := context.Background()
	for _, s := range []string{
		`INSERT INTO testimonials (author_name, quote, rating, is_published, position, listing_id) VALUES ('Second', 'q2', 5, true, 2, '` + active["id"].(string) + `')`,
		`INSERT INTO testimonials (author_name, quote, is_published, position, listing_id) VALUES ('First', 'q1', true, 1, '` + draft["id"].(string) + `')`,
		`INSERT INTO testimonials (author_name, quote, is_published, position) VALUES ('Hidden', 'q3', false, 0)`,
	} {
		if _, err := e.pool.Exec(ctx, s); err != nil {
			t.Fatal(err)
		}
	}

	items := expect(t, e.do(req{method: "GET", path: "/api/testimonials"}), 200)["items"].([]any)
	if len(items) != 2 {
		t.Fatalf("got %d items, want 2 published", len(items))
	}
	first, second := items[0].(map[string]any), items[1].(map[string]any)
	if first["author_name"] != "First" || second["author_name"] != "Second" {
		t.Fatalf("order = %v, %v", first["author_name"], second["author_name"])
	}
	if first["listing_slug"] != nil {
		t.Errorf("draft listing exposed: listing_slug = %v", first["listing_slug"])
	}
	if second["listing_slug"] != active["slug"] || second["rating"] != float64(5) {
		t.Errorf("second = %v", second)
	}
}
