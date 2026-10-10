package chat

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/anthropics/anthropic-sdk-go"

	"brickbot/internal/db"
	"brickbot/internal/services"
)

func row(id int64, role, content string) db.ChatMessage {
	return db.ChatMessage{ID: id, Role: role, Content: []byte(content)}
}

const (
	userText   = `[{"type":"text","text":"hi"}]`
	toolUse    = `[{"type":"tool_use","id":"toolu_1","name":"search_listings","input":{"city":"Pune"}}]`
	toolResult = `[{"type":"tool_result","tool_use_id":"toolu_1","content":"{}"}]`
	assistant  = `[{"type":"text","text":"hello"}]`
)

func TestWindow(t *testing.T) {
	tests := []struct {
		name      string
		rows      []db.ChatMessage
		wantRoles string
		wantErr   bool
	}{
		{"plain", []db.ChatMessage{row(1, "user", userText), row(2, "assistant", assistant)}, "user,assistant", false},
		{"drops leading orphan tool turns", []db.ChatMessage{
			row(1, "assistant", toolUse), row(2, "user", toolResult), row(3, "assistant", assistant),
			row(4, "user", userText), row(5, "assistant", toolUse), row(6, "user", toolResult),
		}, "user,assistant,user", false},
		{"merges same-role rows after a failed turn", []db.ChatMessage{
			row(1, "user", userText), row(2, "user", userText), row(3, "assistant", assistant),
		}, "user,assistant", false},
		{"no plain user turn", []db.ChatMessage{row(1, "user", toolResult)}, "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			msgs, err := window(tt.rows)
			if tt.wantErr {
				if !errors.Is(err, errNoPlainTurn) {
					t.Fatalf("err = %v, want errNoPlainTurn", err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			roles := make([]string, len(msgs))
			for i, m := range msgs {
				roles[i] = string(m.Role)
			}
			if got := strings.Join(roles, ","); got != tt.wantRoles {
				t.Fatalf("roles = %s, want %s", got, tt.wantRoles)
			}
		})
	}
}

// Stored blocks must survive a decode/encode round trip unchanged in meaning,
// since the history is sent back to the API exactly as stored.
func TestWindowRoundTrip(t *testing.T) {
	msgs, err := window([]db.ChatMessage{
		row(1, "user", userText), row(2, "assistant", toolUse), row(3, "user", toolResult), row(4, "user", userText),
	})
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(msgs)
	if err != nil {
		t.Fatal(err)
	}
	got := string(b)
	for _, want := range []string{`"type":"tool_use"`, `"id":"toolu_1"`, `"city":"Pune"`, `"tool_use_id":"toolu_1"`} {
		if !strings.Contains(got, want) {
			t.Errorf("round trip lost %s: %s", want, got)
		}
	}
	if len(msgs) != 3 || len(msgs[2].Content) != 2 {
		t.Fatalf("tool result and next visitor message should merge into one user turn: %s", got)
	}
}

func TestTranscript(t *testing.T) {
	lines := transcript([]db.ChatMessage{
		row(1, "user", userText), row(2, "assistant", toolUse), row(3, "user", toolResult),
		row(4, "assistant", `[{"type":"text","text":"a"},{"type":"text","text":"b"}]`),
	})
	if len(lines) != 2 || lines[0].Text != "hi" || lines[1].Text != "a\n\nb" {
		t.Fatalf("transcript = %+v", lines)
	}
}

func TestTextOnly(t *testing.T) {
	blocks := []anthropic.ContentBlockParamUnion{
		anthropic.NewTextBlock("partial"),
		anthropic.NewToolUseBlock("toolu_1", map[string]any{}, "get_listing"),
		anthropic.NewTextBlock(""),
	}
	if got := textOnly(blocks); len(got) != 1 || got[0].OfText.Text != "partial" {
		t.Fatalf("textOnly = %+v", got)
	}
}

func TestLeadValidate(t *testing.T) {
	yes, no := true, false
	tests := []struct {
		name    string
		in      leadInput
		wantErr string
	}{
		{"ok email", leadInput{Consent: &yes, Name: " Asha ", Email: "asha@example.com"}, ""},
		{"ok phone", leadInput{Consent: &yes, Name: "Asha", Phone: "+91 98765 43210"}, ""},
		{"missing consent", leadInput{Name: "Asha", Email: "asha@example.com"}, "consent"},
		{"consent false", leadInput{Consent: &no, Name: "Asha", Email: "asha@example.com"}, "consent"},
		{"no name", leadInput{Consent: &yes, Email: "asha@example.com"}, "name"},
		{"no contact", leadInput{Consent: &yes, Name: "Asha"}, "phone number or an email"},
		{"bad phone", leadInput{Consent: &yes, Name: "Asha", Phone: "call me"}, "phone"},
		{"bad email", leadInput{Consent: &yes, Name: "Asha", Email: "Asha <asha@example.com>"}, "email"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			in := tt.in
			err := in.validate()
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if in.Name != strings.TrimSpace(tt.in.Name) {
					t.Fatalf("name not trimmed: %q", in.Name)
				}
				return
			}
			if _, ok := errors.AsType[toolError](err); !ok || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("err = %v, want toolError mentioning %q", err, tt.wantErr)
			}
		})
	}
}

func TestSearchValidate(t *testing.T) {
	neg := int64(-1)
	for _, in := range []searchInput{
		{Purpose: "lease"}, {PropertyType: "castle"}, {Sort: "random"}, {MinPrice: &neg}, {MinBedrooms: &neg},
		{Query: strings.Repeat("x", 101)},
	} {
		if err := in.validate(); err == nil {
			t.Errorf("%+v: want error", in)
		}
	}
	if err := (searchInput{Purpose: "rent", PropertyType: "villa", Sort: "price_asc"}).validate(); err != nil {
		t.Fatal(err)
	}
}

func TestBuildPrompt(t *testing.T) {
	p := db.SalesmanProfile{Name: "Ravi Kumar", ServiceAreas: []string{"Bandra"}, Currency: "INR", AreaUnit: "sqft", Phone: "+910000000000"}
	empty := buildPrompt(p, services.Facets{})
	for _, want := range []string{"Ravi Kumar", "Bandra", "INR", "sqft", "create_lead", "consent", "no active listings"} {
		if !strings.Contains(empty, want) {
			t.Errorf("prompt missing %q", want)
		}
	}
	full := buildPrompt(p, services.Facets{
		Purposes:      []db.FacetPurposesRow{{ListingType: "sale", Count: 2, MinPrice: 100, MaxPrice: 200}},
		PropertyTypes: []db.FacetPropertyTypesRow{{PropertyType: "apartment", Count: 2}},
		Cities:        []db.FacetCitiesRow{{City: "Mumbai", Count: 2}},
		Localities:    []db.FacetLocalitiesRow{{City: "Mumbai", Locality: "Bandra", Count: 2}},
	})
	for _, want := range []string{"For sale: 2 listing(s), 100 to 200 INR", "apartment (2)", "Mumbai (2)", "Bandra, Mumbai (2)"} {
		if !strings.Contains(full, want) {
			t.Errorf("prompt missing %q", want)
		}
	}
}
