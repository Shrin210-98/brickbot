package handlers_test

import (
	"context"
	"testing"
)

func TestProfile(t *testing.T) {
	e := newEnv(t)

	p := expect(t, e.do(req{method: "GET", path: "/api/profile"}), 200)
	if p["full_name"] != "Test" || p["agency_name"] != "BrickBot" || p["phone"] != "+910000000000" {
		t.Fatalf("defaults: %v", p)
	}
	for _, k := range []string{"tagline", "headline", "license_no", "years_experience", "deals_closed"} {
		if v, ok := p[k]; !ok || v != nil {
			t.Errorf("%s = %v (present %v), want null", k, v, ok)
		}
	}
	if s, ok := p["specialties"].([]any); !ok || len(s) != 0 {
		t.Errorf("specialties = %v, want []", p["specialties"])
	}
	if s, ok := p["process_steps"].([]any); !ok || len(s) != 0 {
		t.Errorf("process_steps = %v, want []", p["process_steps"])
	}
	if s, ok := p["socials"].(map[string]any); !ok || len(s) != 0 {
		t.Errorf("socials = %v, want {}", p["socials"])
	}

	// No admin write route yet; the profile is updated directly.
	if _, err := e.pool.Exec(context.Background(), `UPDATE salesman_profile SET agency_name = 'Sharma Homes',
		years_experience = 12, specialties = '{"Resales"}',
		process_steps = '[{"title":"Visit","description":"We go together."}]' WHERE id = 1`); err != nil {
		t.Fatal(err)
	}
	p = expect(t, e.do(req{method: "GET", path: "/api/profile"}), 200)
	steps, _ := p["process_steps"].([]any)
	if p["agency_name"] != "Sharma Homes" || p["years_experience"] != float64(12) || len(steps) != 1 {
		t.Fatalf("updated: %v", p)
	}
	if step := steps[0].(map[string]any); step["title"] != "Visit" || step["description"] != "We go together." {
		t.Errorf("step = %v", step)
	}

	// A blank agency_name falls back too.
	if _, err := e.pool.Exec(context.Background(), `UPDATE salesman_profile SET agency_name = '  ' WHERE id = 1`); err != nil {
		t.Fatal(err)
	}
	if p = expect(t, e.do(req{method: "GET", path: "/api/profile"}), 200); p["agency_name"] != "BrickBot" {
		t.Errorf("blank agency_name = %v", p["agency_name"])
	}
}
