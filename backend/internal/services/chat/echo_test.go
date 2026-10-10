package chat

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/jackc/pgx/v5/pgtype"

	"brickbot/internal/services"
)

type recordSink struct {
	deltas []string
	tools  []string
}

func (s *recordSink) Delta(text string)                      { s.deltas = append(s.deltas, text) }
func (s *recordSink) Tool(name string)                       { s.tools = append(s.tools, name) }
func (s *recordSink) Listings(_ []services.ListingWithMedia) {}
func (s *recordSink) LeadCreated(_ pgtype.UUID)              {}

const searchResult = `{"total":2,"listings":[` +
	`{"slug":"sea-view-3-bhk-bandra","title":"3 BHK sea-view apartment","city":"Mumbai","locality":"Bandra West"},` +
	`{"slug":"2-bhk-lokhandwala","title":"2 BHK in Lokhandwala","city":"Mumbai","locality":"Andheri West"}]}`

// afterSearch is a window where the model searched and answered.
func afterSearch(visitor string) []anthropic.MessageParam {
	return []anthropic.MessageParam{
		anthropic.NewUserMessage(anthropic.NewTextBlock("show me flats in Bandra")),
		anthropic.NewAssistantMessage(anthropic.NewTextBlock("Let me check."), anthropic.NewToolUseBlock("toolu_1", map[string]any{"query": "Bandra"}, toolSearch)),
		anthropic.NewUserMessage(anthropic.NewToolResultBlock("toolu_1", searchResult, false)),
		anthropic.NewAssistantMessage(anthropic.NewTextBlock("I found 2 matching listings.")),
		anthropic.NewUserMessage(anthropic.NewTextBlock(visitor)),
	}
}

// echoTurn runs streamTurn against the EchoProvider, so frames go through the
// SDK decoder and Accumulate exactly as API frames do.
func echoTurn(t *testing.T, msgs []anthropic.MessageParam, last bool) (anthropic.Message, *recordSink) {
	t.Helper()
	s := &Service{provider: &EchoProvider{}, model: "claude-haiku-5-5"}
	sink := &recordSink{}
	msg, err := s.streamTurn(context.Background(), "system", msgs, last, sink)
	if err != nil {
		t.Fatal(err)
	}
	return msg, sink
}

func echoToolUse(t *testing.T, msg anthropic.Message) (string, map[string]any) {
	t.Helper()
	for _, b := range msg.Content {
		if use, ok := b.AsAny().(anthropic.ToolUseBlock); ok {
			var in map[string]any
			if err := json.Unmarshal(use.Input, &in); err != nil {
				t.Fatalf("tool input %s: %v", use.Input, err)
			}
			if !strings.HasPrefix(use.ID, "toolu_echo_") {
				t.Errorf("tool id = %q", use.ID)
			}
			return use.Name, in
		}
	}
	return "", nil
}

func TestEchoTurns(t *testing.T) {
	tests := []struct {
		name      string
		msgs      []anthropic.MessageParam
		last      bool
		wantTool  string
		wantInput map[string]any
		wantText  string // substring of the streamed text
	}{
		{
			name:      "first message searches with filters and discloses demo mode",
			msgs:      []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock("Show me 2 BHK flats for rent in Bandra under 60k"))},
			wantTool:  toolSearch,
			wantInput: map[string]any{"purpose": "rent", "property_type": "apartment", "min_bedrooms": 2.0, "max_price": 60000.0, "query": "Bandra"},
			wantText:  echoDisclosure,
		},
		{
			name:     "first greeting",
			msgs:     []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock("hello"))},
			wantText: echoDisclosure + "Hi!",
		},
		{
			name:     "last iteration never calls a tool",
			msgs:     []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock("show me flats in Bandra"))},
			last:     true,
			wantText: "lookup limit",
		},
		{
			name:     "tool result gets a text answer",
			msgs:     afterSearch("unused")[:3],
			wantText: "I found 2 matching listings. The top one is 3 BHK sea-view apartment in Bandra West.",
		},
		{
			name:      "ordinal picks from the latest search",
			msgs:      afterSearch("tell me more about the second one"),
			wantTool:  toolGet,
			wantInput: map[string]any{"slug": "2-bhk-lokhandwala"},
		},
		{
			name:      "consent after a tool result creates a lead",
			msgs:      afterSearch("Yes please share my details, my name is Asha Rao, +91 98765 43210"),
			wantTool:  toolLead,
			wantInput: map[string]any{"consent": true, "name": "Asha Rao", "phone": "+91 98765 43210", "message": "Lead from the demo-mode chatbot."},
		},
		{
			name:     "consent with nothing to consent to is a demo reply",
			msgs:     []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock("hi")), anthropic.NewAssistantMessage(anthropic.NewTextBlock("Hi!")), anthropic.NewUserMessage(anthropic.NewTextBlock("yes"))},
			wantText: "In demo mode",
		},
		{
			name: "a new question after an interrupted tool answers the question",
			msgs: append(afterSearch("unused")[:3],
				anthropic.NewUserMessage(anthropic.NewTextBlock("show me flats in Khar"))),
			wantTool:  toolSearch,
			wantInput: map[string]any{"property_type": "apartment", "query": "Khar"},
		},
		{
			// What the history window actually sends: the orphaned result merged into the next visitor turn.
			name: "a merged orphaned tool result still answers the question",
			msgs: append(afterSearch("unused")[:2], anthropic.NewUserMessage(
				anthropic.NewToolResultBlock("toolu_1", searchResult, false),
				anthropic.NewTextBlock("show me flats in Khar"))),
			wantTool:  toolSearch,
			wantInput: map[string]any{"property_type": "apartment", "query": "Khar"},
		},
		{
			name:     "no visitor text anywhere is a demo reply",
			msgs:     []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewToolResultBlock("toolu_1", searchResult, false))},
			wantText: "In demo mode",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			msg, sink := echoTurn(t, tt.msgs, tt.last)
			name, in := echoToolUse(t, msg)
			if name != tt.wantTool {
				t.Fatalf("tool = %q, want %q", name, tt.wantTool)
			}
			wantStop := anthropic.StopReasonEndTurn
			wantSinkTools := []string(nil)
			if tt.wantTool != "" {
				wantStop, wantSinkTools = anthropic.StopReasonToolUse, []string{tt.wantTool}
			}
			if msg.StopReason != wantStop {
				t.Errorf("stop = %q, want %q", msg.StopReason, wantStop)
			}
			if !reflect.DeepEqual(sink.tools, wantSinkTools) {
				t.Errorf("sink tools = %v, want %v", sink.tools, wantSinkTools)
			}
			if tt.wantInput != nil && !reflect.DeepEqual(in, tt.wantInput) {
				t.Errorf("input = %v, want %v", in, tt.wantInput)
			}
			text := strings.Join(sink.deltas, "")
			if len(sink.deltas) < 2 || !strings.Contains(text, tt.wantText) {
				t.Errorf("deltas = %q, want several containing %q", sink.deltas, tt.wantText)
			}
			if got := msg.Content[0].Text; got != text {
				t.Errorf("accumulated text = %q, streamed %q", got, text)
			}
		})
	}
}

func TestEchoLeadPlaceholders(t *testing.T) {
	msg, _ := echoTurn(t, afterSearch("yes please share my details"), false)
	_, in := echoToolUse(t, msg)
	if in["name"] != "Demo visitor" || in["email"] != "demo-visitor@example.com" || in["consent"] != true {
		t.Errorf("input = %v", in)
	}
}

func TestEchoCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	s := &Service{provider: &EchoProvider{delay: time.Second}, model: "m"}
	msgs := []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock("hi"))}
	if _, err := s.streamTurn(ctx, "system", msgs, false, &recordSink{}); !errors.Is(err, ErrUpstream) || !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v, want ErrUpstream wrapping context.Canceled", err)
	}
}

func TestEchoAmount(t *testing.T) {
	tests := []struct {
		num, unit string
		want      int64
	}{
		{"60", "k", 60_000},
		{"1.5", "cr", 15_000_000},
		{"85", "lakh", 8_500_000},
		{"32,000", "", 32_000},
	}
	for _, tt := range tests {
		if got, ok := echoAmount(tt.num, tt.unit); !ok || got != tt.want {
			t.Errorf("echoAmount(%q, %q) = %d, want %d", tt.num, tt.unit, got, tt.want)
		}
	}
}
