package chat

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/packages/ssestream"
)

// echoDelay paces text deltas so the demo stream is visibly incremental.
const echoDelay = 40 * time.Millisecond

// echoDisclosure opens the first assistant turn of every demo session.
const echoDisclosure = "Demo mode: these replies are scripted. Live answers need an Anthropic API key.\n\n"

// EchoProvider stands in for the model when ANTHROPIC_API_KEY is unset (demo
// mode). It picks a scripted reply or tool call from the conversation and
// streams it as Anthropic SSE frames through the SDK's own decoder, so the
// tool loop, the tools and persistence all run for real. Only the model's
// words are fake.
type EchoProvider struct {
	delay time.Duration // pause before each text delta
}

// NewEchoProvider returns the demo-mode Provider.
func NewEchoProvider() *EchoProvider {
	return &EchoProvider{delay: echoDelay}
}

// Stream implements Provider.
func (p *EchoProvider) Stream(ctx context.Context, params anthropic.MessageNewParams) *Stream {
	r, err := echoPlan(params)
	if err != nil {
		return ssestream.NewStream[anthropic.MessageStreamEventUnion](nil, err)
	}
	events, err := echoFrames(params.Model, r)
	if err != nil {
		return ssestream.NewStream[anthropic.MessageStreamEventUnion](nil, err)
	}
	return ssestream.NewStream[anthropic.MessageStreamEventUnion](&echoDecoder{ctx: ctx, delay: p.delay, events: events}, nil)
}

// echoEvent is one SSE frame; paced frames wait for the delay first.
type echoEvent struct {
	ssestream.Event
	paced bool
}

// echoDecoder replays prepared frames as an ssestream.Decoder.
type echoDecoder struct {
	ctx    context.Context
	delay  time.Duration
	events []echoEvent
	cur    ssestream.Event
	err    error
}

func (d *echoDecoder) Next() bool {
	if d.err != nil || len(d.events) == 0 {
		return false
	}
	e := d.events[0]
	d.events = d.events[1:]
	if e.paced && d.delay > 0 {
		select {
		case <-d.ctx.Done():
			d.err = d.ctx.Err()
			return false
		case <-time.After(d.delay):
		}
	}
	d.cur = e.Event
	return true
}

func (d *echoDecoder) Event() ssestream.Event { return d.cur }
func (d *echoDecoder) Close() error           { return nil }
func (d *echoDecoder) Err() error             { return d.err }

// echoReply is what one scripted model turn says and does.
type echoReply struct {
	text string
	tool *echoCall // nil: the turn ends in text
}

type echoCall struct {
	name  string
	input map[string]any
}

// echoFrames renders r as the frames the Messages API streams: message_start,
// a text block, an optional tool_use block, message_delta and message_stop.
func echoFrames(model string, r echoReply) ([]echoEvent, error) {
	var events []echoEvent
	add := func(typ string, paced bool, frame map[string]any) error {
		frame["type"] = typ
		data, err := json.Marshal(frame)
		if err != nil {
			return fmt.Errorf("echo frame %s: %w", typ, err)
		}
		events = append(events, echoEvent{Event: ssestream.Event{Type: typ, Data: data}, paced: paced})
		return nil
	}
	stop := anthropic.StopReasonEndTurn
	if r.tool != nil {
		stop = anthropic.StopReasonToolUse
	}

	if err := add("message_start", false, map[string]any{"message": map[string]any{
		"id": "msg_echo_" + rand.Text(), "type": "message", "role": "assistant", "model": model,
		"content": []any{}, "stop_reason": nil, "stop_sequence": nil,
		"usage": map[string]any{"input_tokens": 0, "output_tokens": 0},
	}}); err != nil {
		return nil, err
	}
	if err := add("content_block_start", false, map[string]any{"index": 0, "content_block": map[string]any{"type": "text", "text": ""}}); err != nil {
		return nil, err
	}
	for _, chunk := range echoChunks(r.text) {
		if err := add("content_block_delta", true, map[string]any{"index": 0, "delta": map[string]any{"type": "text_delta", "text": chunk}}); err != nil {
			return nil, err
		}
	}
	if err := add("content_block_stop", false, map[string]any{"index": 0}); err != nil {
		return nil, err
	}
	if r.tool != nil {
		input, err := json.Marshal(r.tool.input)
		if err != nil {
			return nil, fmt.Errorf("echo tool input: %w", err)
		}
		if err := add("content_block_start", false, map[string]any{"index": 1, "content_block": map[string]any{
			"type": "tool_use", "id": "toolu_echo_" + rand.Text(), "name": r.tool.name, "input": map[string]any{},
		}}); err != nil {
			return nil, err
		}
		if err := add("content_block_delta", false, map[string]any{"index": 1, "delta": map[string]any{"type": "input_json_delta", "partial_json": string(input)}}); err != nil {
			return nil, err
		}
		if err := add("content_block_stop", false, map[string]any{"index": 1}); err != nil {
			return nil, err
		}
	}
	if err := add("message_delta", false, map[string]any{
		"delta": map[string]any{"stop_reason": stop, "stop_sequence": nil},
		"usage": map[string]any{"output_tokens": len(strings.Fields(r.text))},
	}); err != nil {
		return nil, err
	}
	if err := add("message_stop", false, map[string]any{}); err != nil {
		return nil, err
	}
	return events, nil
}

// echoChunks splits text into deltas of a few words each.
func echoChunks(text string) []string {
	words := strings.SplitAfter(text, " ")
	var out []string
	for i := 0; i < len(words); i += 3 {
		out = append(out, strings.Join(words[i:min(i+3, len(words))], ""))
	}
	return out
}

// echoMessage and echoBlock read the request's history back from its wire JSON.
type echoMessage struct {
	Role    string      `json:"role"`
	Content []echoBlock `json:"content"`
}

type echoBlock struct {
	Type      string          `json:"type"`
	Text      string          `json:"text"`
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Input     json.RawMessage `json:"input"`
	ToolUseID string          `json:"tool_use_id"`
	Content   json.RawMessage `json:"content"`
	IsError   bool            `json:"is_error"`
}

func (m echoMessage) text() string {
	var parts []string
	for _, b := range m.Content {
		if b.Type == "text" {
			parts = append(parts, b.Text)
		}
	}
	return strings.Join(parts, " ")
}

func (m echoMessage) has(typ string) bool {
	for _, b := range m.Content {
		if b.Type == typ {
			return true
		}
	}
	return false
}

// resultText returns a tool_result's content, sent as a string or as text blocks.
func (b echoBlock) resultText() string {
	var s string
	if json.Unmarshal(b.Content, &s) == nil {
		return s
	}
	var blocks []echoBlock
	_ = json.Unmarshal(b.Content, &blocks)
	var parts []string
	for _, c := range blocks {
		parts = append(parts, c.Text)
	}
	return strings.Join(parts, "")
}

// echoListing is the part of a search_listings or get_listing result the
// scripted replies use.
type echoListing struct {
	Slug        string `json:"slug"`
	Title       string `json:"title"`
	Locality    string `json:"locality"`
	Description string `json:"description"`
}

// echoFacts is what earlier tool rounds in the window established.
type echoFacts struct {
	results []echoListing // latest successful search, in order
	viewed  string        // slug of the latest successful get_listing
}

func echoFactsOf(msgs []echoMessage) echoFacts {
	var f echoFacts
	calls := map[string]string{} // tool_use id → tool name
	for _, m := range msgs {
		for _, b := range m.Content {
			switch {
			case b.Type == "tool_use":
				calls[b.ID] = b.Name
			case b.Type == "tool_result" && !b.IsError:
				switch calls[b.ToolUseID] {
				case toolSearch:
					var out struct {
						Listings []echoListing `json:"listings"`
					}
					if json.Unmarshal([]byte(b.resultText()), &out) == nil {
						f.results = out.Listings
					}
				case toolGet:
					var l echoListing
					if json.Unmarshal([]byte(b.resultText()), &l) == nil {
						f.viewed = l.Slug
					}
				}
			}
		}
	}
	return f
}

// echoPlan decides the next scripted turn from the request.
func echoPlan(params anthropic.MessageNewParams) (echoReply, error) {
	raw, err := json.Marshal(params.Messages)
	if err != nil {
		return echoReply{}, fmt.Errorf("echo history: %w", err)
	}
	var msgs []echoMessage
	if err := json.Unmarshal(raw, &msgs); err != nil {
		return echoReply{}, fmt.Errorf("echo history: %w", err)
	}
	if len(msgs) == 0 {
		return echoReply{}, fmt.Errorf("echo history: no messages")
	}

	first := true
	for _, m := range msgs {
		if m.Role == roleAssistant {
			first = false
		}
	}
	r := echoDecide(msgs, first)
	if r.tool != nil && params.ToolChoice.OfNone != nil {
		r = echoReply{text: "I've reached the lookup limit for this message. Please ask again."}
	}
	if first {
		r.text = echoDisclosure + r.text
	}
	return r, nil
}

var (
	reConsent  = regexp.MustCompile(`\b(yes|yeah|yep|sure|ok|okay|share|contact me|call me)\b`)
	reDetails  = regexp.MustCompile(`\b(more|details?|tell me about|info)\b`)
	reSearch   = regexp.MustCompile(`\b(find|show|search|looking|list|flats?|apartments?|bhk|villas?|houses?|plots?|office|shop|commercial|under|below|budget|rent|rental|lease|sale|buy)\b|\b(in|at|near|around) [a-z]`)
	reGreeting = regexp.MustCompile(`^\s*(hi|hello|hey|namaste|good (morning|afternoon|evening))\b`)
	reSlug     = regexp.MustCompile(`\b[a-z0-9]+(?:-[a-z0-9]+){2,}\b`)
	reOrdinal  = regexp.MustCompile(`\b(first|second|third|fourth|fifth|last|[1-5](?:st|nd|rd|th)|#[1-5])\b`)

	rePlace    = regexp.MustCompile(`(?i)\b(?:in|at|near|around)\s+([a-z][a-z .'-]*?)\s*(?:$|[,.?!]|\b(?:under|below|for|with|within|upto|up to|budget|less|max|from|and|to|on|above|over)\b)`)
	reMaxPrice = regexp.MustCompile(`(?i)\b(?:under|below|up ?to|within|less than|max(?:imum)?|budget(?: of)?)\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(k|thousand|l|lakhs?|lacs?|cr|crores?)?\b`)
	reMinPrice = regexp.MustCompile(`(?i)\b(?:above|over|more than|min(?:imum)?|from)\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(k|thousand|l|lakhs?|lacs?|cr|crores?)?\b`)
	reBedrooms = regexp.MustCompile(`(?i)\b([0-9]{1,2})\s*(?:bhk|bed(?:room)?s?)\b`)

	reNamed    = regexp.MustCompile(`(?i)\b(?:my name is|name is|name:)\s*([a-z][a-z.'-]*(?:\s+[a-z][a-z.'-]*)?)`)
	reIntro    = regexp.MustCompile(`(?i)\b(?:i am|i'm|this is)\s+([a-z][a-z.'-]*(?:\s+[a-z][a-z.'-]*)?)`)
	rePhone    = regexp.MustCompile(`\+?[0-9][0-9 ()-]{6,18}[0-9]`)
	reEmail    = regexp.MustCompile(`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`)
	placeStops = map[string]bool{"a": true, "my": true, "budget": true, "it": true, "this": true}
	nameStops  = map[string]bool{"and": true, "my": true, "phone": true, "email": true, "number": true, "at": true, "on": true}
	ordinalPos = map[string]int{"first": 0, "second": 1, "third": 2, "fourth": 3, "fifth": 4}
)

// echoDecide picks the scripted turn. A tool_result turn always gets a text
// answer, so the tool loop ends after one round.
func echoDecide(msgs []echoMessage, first bool) echoReply {
	n := len(msgs)
	last := msgs[n-1]
	if last.has("tool_result") {
		return echoAfterTools(msgs)
	}
	raw := last.text()
	text := strings.ToLower(raw)
	facts := echoFactsOf(msgs)

	// Consent counts only right after a reply that followed a tool result.
	afterTool := n >= 3 && msgs[n-2].Role == roleAssistant && msgs[n-3].has("tool_result")
	if afterTool && reConsent.MatchString(text) {
		return echoReply{text: "Sharing your details now.\n\n", tool: &echoCall{name: toolLead, input: echoLeadInput(raw, facts)}}
	}
	if reDetails.MatchString(text) || reSlug.MatchString(text) {
		if slug := echoPickSlug(text, facts); slug != "" {
			return echoReply{text: "Here are the details.\n\n", tool: &echoCall{name: toolGet, input: map[string]any{"slug": slug}}}
		}
	}
	if reSearch.MatchString(text) {
		return echoReply{text: "Let me check the listings.\n\n", tool: &echoCall{name: toolSearch, input: echoSearchInput(raw)}}
	}
	if first || reGreeting.MatchString(text) {
		return echoReply{text: `Hi! I can search the listings for you. Try "show me 2 BHK flats for rent in Bandra under 60k".`}
	}
	return echoReply{text: `In demo mode I can search listings, show details and pass your details on. Try "show me flats in Bandra", "tell me more about the first one", or "yes, share my details".`}
}

// echoPickSlug returns a slug named in text, else the listing an ordinal
// points at in the latest search, else that search's first listing.
func echoPickSlug(text string, f echoFacts) string {
	if s := reSlug.FindString(text); s != "" {
		return s
	}
	if len(f.results) == 0 {
		return ""
	}
	if m := reOrdinal.FindString(text); m != "" {
		i, ok := ordinalPos[m]
		switch {
		case m == "last":
			i, ok = len(f.results)-1, true
		case !ok:
			d, _ := strconv.Atoi(strings.TrimLeft(m, "#")[:1])
			i, ok = d-1, true
		}
		if ok && i < len(f.results) {
			return f.results[i].Slug
		}
	}
	return f.results[0].Slug
}

// echoSearchInput reads search_listings filters from a visitor message.
func echoSearchInput(raw string) map[string]any {
	text := strings.ToLower(raw)
	in := map[string]any{}
	has := func(words string) bool { return regexp.MustCompile(`\b(` + words + `)\b`).MatchString(text) }

	rent, sale := has("rent|rental|renting|lease"), has("buy|buying|sale|purchase")
	switch {
	case rent && !sale:
		in["purpose"] = "rent"
	case sale && !rent:
		in["purpose"] = "sale"
	}
	switch {
	case has("flats?|apartments?|bhk"):
		in["property_type"] = "apartment"
	case has("villas?"):
		in["property_type"] = "villa"
	case has("houses?|bungalows?"):
		in["property_type"] = "house"
	case has("plots?|land"):
		in["property_type"] = "plot"
	case has("office|shop|commercial"):
		in["property_type"] = "commercial"
	}
	if m := reBedrooms.FindStringSubmatch(raw); m != nil {
		n, _ := strconv.Atoi(m[1])
		in["min_bedrooms"] = n
	}
	if m := reMaxPrice.FindStringSubmatch(raw); m != nil {
		if p, ok := echoAmount(m[1], m[2]); ok {
			in["max_price"] = p
		}
	}
	if m := reMinPrice.FindStringSubmatch(raw); m != nil {
		if p, ok := echoAmount(m[1], m[2]); ok {
			in["min_price"] = p
		}
	}
	if m := rePlace.FindStringSubmatch(raw); m != nil {
		place := strings.TrimSpace(m[1])
		if len(place) > 4 && strings.EqualFold(place[:4], "the ") {
			place = strings.TrimSpace(place[4:])
		}
		if place != "" && !placeStops[strings.ToLower(place)] && utf8.RuneCountInString(place) <= 100 {
			in["query"] = place
		}
	}
	switch {
	case has("cheapest|lowest"):
		in["sort"] = "price_asc"
	case has("newest|latest"):
		in["sort"] = "newest"
	}
	return in
}

// echoAmount turns "50" + "k" or "1.5" + "cr" into a whole amount.
func echoAmount(num, unit string) (int64, bool) {
	f, err := strconv.ParseFloat(strings.ReplaceAll(num, ",", ""), 64)
	if err != nil || f < 0 {
		return 0, false
	}
	switch u := strings.ToLower(unit); {
	case u == "k" || u == "thousand":
		f *= 1e3
	case u == "l" || strings.HasPrefix(u, "lakh") || strings.HasPrefix(u, "lac"):
		f *= 1e5
	case u == "cr" || strings.HasPrefix(u, "crore"):
		f *= 1e7
	}
	return int64(f), true
}

// echoLeadInput reads a name and contact from the consent message. Demo mode
// fills placeholders for anything missing, so the lead flow always completes.
func echoLeadInput(raw string, f echoFacts) map[string]any {
	in := map[string]any{"consent": true}
	name := ""
	if m := reNamed.FindStringSubmatch(raw); m != nil {
		name = m[1]
	} else if m := reIntro.FindStringSubmatch(raw); m != nil && unicode.IsUpper([]rune(m[1])[0]) {
		name = m[1]
	}
	if words := strings.Fields(name); len(words) == 2 && nameStops[strings.ToLower(words[1])] {
		name = words[0]
	}
	phone := ""
	for _, c := range rePhone.FindAllString(raw, -1) {
		if c = strings.TrimSpace(c); phoneRE.MatchString(c) {
			phone = c
			break
		}
	}
	email := reEmail.FindString(raw)

	placeholder := false
	if name == "" {
		name, placeholder = "Demo visitor", true
	}
	if phone == "" && email == "" {
		email, placeholder = "demo-visitor@example.com", true
	}
	in["name"] = name
	if phone != "" {
		in["phone"] = phone
	}
	if email != "" {
		in["email"] = email
	}
	in["message"] = "Lead from the demo-mode chatbot."
	if placeholder {
		in["message"] = "Lead from the demo-mode chatbot. Name or contact details are placeholders."
	}
	if f.viewed != "" {
		in["listing_slug"] = f.viewed
	}
	return in
}

// echoAfterTools answers the tool results in the last message.
func echoAfterTools(msgs []echoMessage) echoReply {
	n := len(msgs)
	calls := map[string]string{}
	if n >= 2 {
		for _, b := range msgs[n-2].Content {
			if b.Type == "tool_use" {
				calls[b.ID] = b.Name
			}
		}
	}
	var parts []string
	for _, b := range msgs[n-1].Content {
		if b.Type != "tool_result" {
			continue
		}
		out := b.resultText()
		name := calls[b.ToolUseID]
		if b.IsError {
			msg := "That didn't work: " + out + "."
			if name == toolLead {
				msg += ` Send your name and a phone number or email, like "yes, my name is Asha, +91 98765 43210".`
			}
			parts = append(parts, msg)
			continue
		}
		switch name {
		case toolSearch:
			var res struct {
				Total    int64         `json:"total"`
				Listings []echoListing `json:"listings"`
			}
			_ = json.Unmarshal([]byte(out), &res)
			if len(res.Listings) == 0 {
				parts = append(parts, "I couldn't find an active listing that matches. Try another area, a higher budget or fewer filters.")
				continue
			}
			top := res.Listings[0]
			parts = append(parts, fmt.Sprintf(
				`I found %d matching %s. The top one is %s. Say "tell me more about the first one" for details, or "yes, share my details" for a call back.`,
				res.Total, plural(res.Total, "listing", "listings"), named(top)))
		case toolGet:
			var l echoListing
			_ = json.Unmarshal([]byte(out), &l)
			desc := l.Description
			if r := []rune(desc); len(r) > 200 {
				desc = strings.TrimSpace(string(r[:200])) + "…"
			}
			parts = append(parts, strings.TrimSpace(fmt.Sprintf(
				`%s. %s If you'd like a call back about it, say "yes, share my details" with your name and phone number.`,
				named(l), desc)))
		case toolLead:
			parts = append(parts, "Thanks! Your details are with the agent, who will get in touch soon.")
		default:
			parts = append(parts, "Done.")
		}
	}
	return echoReply{text: strings.Join(parts, "\n\n")}
}

// named is the listing title plus where it is, unless the title already says.
func named(l echoListing) string {
	if l.Locality == "" || strings.Contains(l.Title, l.Locality) {
		return l.Title
	}
	return l.Title + " in " + l.Locality
}

func plural(n int64, one, many string) string {
	if n == 1 {
		return one
	}
	return many
}
