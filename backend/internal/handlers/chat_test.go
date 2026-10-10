package handlers_test

// End-to-end chatbot tests: the real SDK client talks to fakeAnthropic, which
// replays scripted Messages API streams and records every request body.

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

const visitor = "11111111-1111-4111-8111-111111111111"

type fakeAnthropic struct {
	t       *testing.T
	mu      sync.Mutex
	replies []string         // one SSE body per request, in order
	bodies  []map[string]any // request bodies received
	status  int              // non-zero: fail every request with this status
	entered chan struct{}    // if set, signalled when a request arrives…
	hold    chan struct{}    // …which then waits until hold is closed
}

func newFakeAnthropic(t *testing.T, replies ...string) (*fakeAnthropic, string) {
	f := &fakeAnthropic{t: t, replies: replies}
	srv := httptest.NewServer(f)
	t.Cleanup(srv.Close)
	return f, srv.URL
}

func (f *fakeAnthropic) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/v1/messages" {
		f.t.Errorf("unexpected request %s %s", r.Method, r.URL.Path)
		http.NotFound(w, r)
		return
	}
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		f.t.Errorf("decode request: %v", err)
	}
	f.mu.Lock()
	f.bodies = append(f.bodies, body)
	n := len(f.bodies) - 1
	f.mu.Unlock()

	if f.entered != nil {
		f.entered <- struct{}{}
		<-f.hold
	}
	if f.status != 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(f.status)
		_, _ = io.WriteString(w, `{"type":"error","error":{"type":"api_error","message":"boom"}}`)
		return
	}
	if n >= len(f.replies) {
		f.t.Errorf("unexpected model call #%d", n+1)
		http.Error(w, "no reply scripted", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	_, _ = io.WriteString(w, f.replies[n])
}

func (f *fakeAnthropic) requests() []map[string]any {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]map[string]any(nil), f.bodies...)
}

// sseEvents renders Messages API stream events, naming each by its "type".
func sseEvents(datas ...string) string {
	var b strings.Builder
	for _, d := range datas {
		var ev struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal([]byte(d), &ev); err != nil {
			panic(err)
		}
		b.WriteString("event: " + ev.Type + "\ndata: " + d + "\n\n")
	}
	return b.String()
}

const messageStart = `{"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-haiku-5-5","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":1}}}`

func stopEvents(reason string) []string {
	return []string{
		`{"type":"message_delta","delta":{"stop_reason":"` + reason + `","stop_sequence":null},"usage":{"output_tokens":5}}`,
		`{"type":"message_stop"}`,
	}
}

func textReply(text string) string {
	t, _ := json.Marshal(text)
	return sseEvents(append([]string{
		messageStart,
		`{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`,
		`{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":` + string(t) + `}}`,
		`{"type":"content_block_stop","index":0}`,
	}, stopEvents("end_turn")...)...)
}

func toolReply(id, name, input string) string {
	in, _ := json.Marshal(input)
	return sseEvents(append([]string{
		messageStart,
		`{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"` + id + `","name":"` + name + `","input":{}}}`,
		`{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":` + string(in) + `}}`,
		`{"type":"content_block_stop","index":0}`,
	}, stopEvents("tool_use")...)...)
}

type sseEvent struct {
	name string
	data map[string]any
}

func parseSSE(t *testing.T, rec *httptest.ResponseRecorder) []sseEvent {
	t.Helper()
	if ct := rec.Header().Get("Content-Type"); ct != "text/event-stream" {
		t.Fatalf("content type %q, want text/event-stream: %s", ct, rec.Body)
	}
	var out []sseEvent
	for _, chunk := range strings.Split(strings.TrimSpace(rec.Body.String()), "\n\n") {
		var ev sseEvent
		for _, line := range strings.Split(chunk, "\n") {
			if v, ok := strings.CutPrefix(line, "event: "); ok {
				ev.name = v
			} else if v, ok := strings.CutPrefix(line, "data: "); ok {
				if err := json.Unmarshal([]byte(v), &ev.data); err != nil {
					t.Fatalf("event data %q: %v", v, err)
				}
			}
		}
		out = append(out, ev)
	}
	return out
}

func eventNames(evs []sseEvent) string {
	names := make([]string, len(evs))
	for i, ev := range evs {
		names[i] = ev.name
	}
	return strings.Join(names, ",")
}

func (e *env) startChat() string {
	e.t.Helper()
	body := expect(e.t, e.do(req{method: "POST", path: "/api/chat/sessions", body: map[string]any{"visitor_id": visitor}}), http.StatusCreated)
	return body["id"].(string)
}

func (e *env) say(session, text string) []sseEvent {
	e.t.Helper()
	rec := e.do(req{method: "POST", path: "/api/chat/sessions/" + session + "/messages", body: map[string]any{"visitor_id": visitor, "content": text}})
	if rec.Code != http.StatusOK {
		e.t.Fatalf("send: %d %s", rec.Code, rec.Body)
	}
	return parseSSE(e.t, rec)
}

func TestChatDisabled(t *testing.T) {
	e := newEnv(t)
	const id = "00000000-0000-0000-0000-000000000001"
	expect(t, e.do(req{method: "POST", path: "/api/chat/sessions", body: map[string]any{"visitor_id": visitor}}), http.StatusServiceUnavailable)
	expect(t, e.do(req{method: "GET", path: "/api/chat/sessions/" + id + "/messages?visitor_id=" + visitor}), http.StatusServiceUnavailable)
	expect(t, e.do(req{method: "POST", path: "/api/chat/sessions/" + id + "/messages", body: map[string]any{"visitor_id": visitor, "content": "hi"}}), http.StatusServiceUnavailable)
	if p := expect(t, e.do(req{method: "GET", path: "/api/profile"}), http.StatusOK); p["chat_enabled"] != false {
		t.Fatalf("chat_enabled = %v, want false", p["chat_enabled"])
	}
}

func TestChatSessionAndTranscript(t *testing.T) {
	fake, url := newFakeAnthropic(t, textReply("Hello there"))
	e := newEnvWithChat(t, url)
	if p := expect(t, e.do(req{method: "GET", path: "/api/profile"}), http.StatusOK); p["chat_enabled"] != true {
		t.Fatalf("chat_enabled = %v, want true", p["chat_enabled"])
	}

	bad := expect(t, e.do(req{method: "POST", path: "/api/chat/sessions", body: map[string]any{"visitor_id": "nope"}}), http.StatusUnprocessableEntity)
	if _, ok := errFields(bad)["visitor_id"]; !ok {
		t.Fatalf("missing visitor_id field error: %v", bad)
	}
	expect(t, e.do(req{method: "POST", path: "/api/chat/sessions", body: map[string]any{"visitor_id": visitor}, origin: "https://evil.example"}), http.StatusForbidden)
	id := e.startChat()
	msgs := "/api/chat/sessions/" + id + "/messages"

	// Only the owning visitor sees the session; everything else is 404.
	other := "22222222-2222-4222-8222-222222222222"
	expect(t, e.do(req{method: "GET", path: msgs + "?visitor_id=" + other}), http.StatusNotFound)
	expect(t, e.do(req{method: "GET", path: msgs}), http.StatusNotFound)
	expect(t, e.do(req{method: "GET", path: "/api/chat/sessions/00000000-0000-0000-0000-000000000000/messages?visitor_id=" + visitor}), http.StatusNotFound)
	expect(t, e.do(req{method: "POST", path: msgs, body: map[string]any{"visitor_id": other, "content": "hi"}}), http.StatusNotFound)
	expect(t, e.do(req{method: "POST", path: msgs, body: map[string]any{"visitor_id": visitor, "content": "   "}}), http.StatusUnprocessableEntity)
	expect(t, e.do(req{method: "POST", path: msgs, body: map[string]any{"visitor_id": visitor, "content": "hi"}, origin: "https://evil.example"}), http.StatusForbidden)

	evs := e.say(id, "  Hi  ")
	if got := eventNames(evs); got != "delta,done" || evs[0].data["text"] != "Hello there" {
		t.Fatalf("events = %s %v", got, evs)
	}

	// The model call follows docs/chatbot.md → Model config.
	reqs := fake.requests()
	if len(reqs) != 1 {
		t.Fatalf("%d model calls, want 1", len(reqs))
	}
	call := reqs[0]
	if call["model"] != "claude-haiku-5-5" || call["stream"] != true || call["max_tokens"] != float64(4096) {
		t.Errorf("model/stream/max_tokens = %v/%v/%v", call["model"], call["stream"], call["max_tokens"])
	}
	if th, _ := call["thinking"].(map[string]any); th["type"] != "disabled" {
		t.Errorf("thinking = %v", call["thinking"])
	}
	if oc, _ := call["output_config"].(map[string]any); oc["effort"] != "low" {
		t.Errorf("output_config = %v", call["output_config"])
	}
	for _, k := range []string{"temperature", "top_p", "top_k", "tool_choice"} {
		if _, ok := call[k]; ok {
			t.Errorf("request must not set %s", k)
		}
	}
	if tools, _ := call["tools"].([]any); len(tools) != 3 {
		t.Errorf("%d tools, want 3", len(tools))
	}
	if m, _ := call["messages"].([]any); len(m) != 1 || !strings.Contains(mustJSON(t, m), `"text":"Hi"`) {
		t.Errorf("messages = %s", mustJSON(t, m))
	}

	lines := expect(t, e.do(req{method: "GET", path: msgs + "?visitor_id=" + visitor}), http.StatusOK)["items"].([]any)
	if len(lines) != 2 {
		t.Fatalf("transcript = %v", lines)
	}
	first, second := lines[0].(map[string]any), lines[1].(map[string]any)
	if first["role"] != "user" || first["text"] != "Hi" || second["role"] != "assistant" || second["text"] != "Hello there" {
		t.Fatalf("transcript = %v", lines)
	}
}

func TestChatToolLoop(t *testing.T) {
	fake, url := newFakeAnthropic(t,
		toolReply("toolu_1", "search_listings", `{"city":"mumbai"}`),
		textReply("I found one."),
	)
	e := newEnvWithChat(t, url)
	c := e.login()
	listing := createListing(t, e, c, map[string]any{"status": "active"})
	createListing(t, e, c, map[string]any{"status": "draft"}) // never visible to the bot
	id := e.startChat()

	evs := e.say(id, "Anything in Mumbai?")
	if got := eventNames(evs); got != "tool,listings,delta,done" {
		t.Fatalf("events = %s", got)
	}
	if evs[0].data["name"] != "search_listings" {
		t.Fatalf("tool event = %v", evs[0].data)
	}
	items := evs[1].data["items"].([]any)
	if len(items) != 1 || items[0].(map[string]any)["slug"] != listing["slug"] || items[0].(map[string]any)["cover_url"] != nil {
		t.Fatalf("listings event = %v", items)
	}

	reqs := fake.requests()
	if len(reqs) != 2 {
		t.Fatalf("%d model calls, want 2", len(reqs))
	}
	second := reqs[1]["messages"].([]any)
	if len(second) != 3 {
		t.Fatalf("second call messages = %s", mustJSON(t, second))
	}
	use := mustJSON(t, second[1])
	result := mustJSON(t, second[2])
	if !strings.Contains(use, `"type":"tool_use"`) || !strings.Contains(use, `"id":"toolu_1"`) || !strings.Contains(use, `mumbai`) {
		t.Errorf("assistant turn = %s", use)
	}
	if !strings.Contains(result, `"tool_use_id":"toolu_1"`) || !strings.Contains(result, listing["slug"].(string)) || !strings.Contains(result, `\"total\":1`) {
		t.Errorf("tool result turn = %s", result)
	}

	lines := expect(t, e.do(req{method: "GET", path: "/api/chat/sessions/" + id + "/messages?visitor_id=" + visitor}), http.StatusOK)["items"].([]any)
	if len(lines) != 2 {
		t.Fatalf("transcript should hide tool turns: %v", lines)
	}
}

func TestChatLeadConsentAndLoopCap(t *testing.T) {
	lead := `{"consent":true,"name":"Asha","email":"asha@example.com","message":"2 BHK"}`
	fake, url := newFakeAnthropic(t,
		toolReply("toolu_1", "create_lead", `{"consent":false,"name":"Asha","email":"asha@example.com"}`),
		toolReply("toolu_2", "create_lead", lead),
		toolReply("toolu_3", "create_lead", lead),
		textReply("Done, the salesman will call you."),
	)
	e := newEnvWithChat(t, url)
	id := e.startChat()

	evs := e.say(id, "Yes, please share my email.")
	if got := eventNames(evs); got != "tool,tool,lead_created,tool,delta,done" {
		t.Fatalf("events = %s", got)
	}

	reqs := fake.requests()
	if len(reqs) != 4 {
		t.Fatalf("%d model calls, want 4", len(reqs))
	}
	for i, r := range reqs[:3] {
		if _, ok := r["tool_choice"]; ok {
			t.Errorf("call %d sets tool_choice", i+1)
		}
	}
	if tc, _ := reqs[3]["tool_choice"].(map[string]any); tc["type"] != "none" {
		t.Errorf("4th call tool_choice = %v, want none", reqs[3]["tool_choice"])
	}
	msgs := reqs[3]["messages"].([]any)
	noConsent, dup := mustJSON(t, msgs[2]), mustJSON(t, msgs[6])
	if !strings.Contains(noConsent, `"is_error":true`) || !strings.Contains(noConsent, "consent") {
		t.Errorf("no-consent result = %s", noConsent)
	}
	if !strings.Contains(dup, `"is_error":true`) || !strings.Contains(dup, "already recorded") {
		t.Errorf("duplicate lead result = %s", dup)
	}

	list := expect(t, e.do(req{method: "GET", path: "/api/admin/inquiries", cookie: e.login()}), http.StatusOK)
	if list["total"] != float64(1) {
		t.Fatalf("inquiries total = %v, want 1", list["total"])
	}
	inq := list["items"].([]any)[0].(map[string]any)
	if inq["source"] != "chat" || inq["email"] != "asha@example.com" || inq["id"] != evs[2].data["inquiry_id"] {
		t.Fatalf("chat inquiry = %v (event %v)", inq, evs[2].data)
	}
}

func TestChatUpstreamError(t *testing.T) {
	fake, url := newFakeAnthropic(t)
	fake.status = http.StatusInternalServerError
	e := newEnvWithChat(t, url)
	id := e.startChat()

	evs := e.say(id, "Hi")
	if got := eventNames(evs); got != "error" || evs[0].data["code"] != "upstream" {
		t.Fatalf("events = %s %v", got, evs)
	}
	lines := expect(t, e.do(req{method: "GET", path: "/api/chat/sessions/" + id + "/messages?visitor_id=" + visitor}), http.StatusOK)["items"].([]any)
	if len(lines) != 1 || lines[0].(map[string]any)["role"] != "user" {
		t.Fatalf("transcript = %v", lines)
	}
}

func TestChatConcurrentStream(t *testing.T) {
	fake, url := newFakeAnthropic(t, textReply("First."))
	fake.entered, fake.hold = make(chan struct{}, 1), make(chan struct{})
	e := newEnvWithChat(t, url)
	id := e.startChat()
	path := "/api/chat/sessions/" + id + "/messages"

	done := make(chan *httptest.ResponseRecorder)
	go func() {
		done <- e.do(req{method: "POST", path: path, body: map[string]any{"visitor_id": visitor, "content": "one"}})
	}()
	<-fake.entered // the first turn is now streaming
	expect(t, e.do(req{method: "POST", path: path, body: map[string]any{"visitor_id": visitor, "content": "two"}}), http.StatusConflict)
	close(fake.hold)
	if got := eventNames(parseSSE(t, <-done)); got != "delta,done" {
		t.Fatalf("first stream events = %s", got)
	}
}

func TestChatRateLimited(t *testing.T) {
	_, url := newFakeAnthropic(t)
	e := newEnvWithChat(t, url)
	id := e.startChat()
	path := "/api/chat/sessions/" + id + "/messages"
	body := map[string]any{"visitor_id": visitor, "content": ""} // 422: no model call
	for range 5 {
		expect(t, e.do(req{method: "POST", path: path, body: body}), http.StatusUnprocessableEntity)
	}
	rec := e.do(req{method: "POST", path: path, body: body})
	expect(t, rec, http.StatusTooManyRequests)
	if rec.Header().Get("Retry-After") == "" {
		t.Fatal("missing Retry-After")
	}
	expect(t, e.do(req{method: "POST", path: path, body: body, remote: "198.51.100.7:1"}), http.StatusUnprocessableEntity)
}

func mustJSON(t *testing.T, v any) string {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}
