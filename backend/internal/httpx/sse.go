package httpx

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// SSE writes a text/event-stream response: one `event:` line and one JSON
// `data:` line per event, flushed immediately. The event contract for the
// chatbot is in docs/chatbot.md.
type SSE struct {
	w  http.ResponseWriter
	rc *http.ResponseController
}

// NewSSE writes the 200 stream headers and lifts the write deadline, so a long
// stream is not cut off. Errors must be written as JSON before calling it.
func NewSSE(w http.ResponseWriter) *SSE {
	rc := http.NewResponseController(w)
	_ = rc.SetWriteDeadline(time.Time{}) // not every writer supports deadlines (tests)
	h := w.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-cache")
	h.Set("X-Accel-Buffering", "no") // keep reverse proxies from buffering the stream
	w.WriteHeader(http.StatusOK)
	return &SSE{w: w, rc: rc}
}

// Send writes one event and flushes it.
func (s *SSE) Send(event string, data any) error {
	b, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshal %s event: %w", event, err)
	}
	if _, err := fmt.Fprintf(s.w, "event: %s\ndata: %s\n\n", event, b); err != nil {
		return err
	}
	return s.rc.Flush()
}
