package chat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/jackc/pgx/v5/pgtype"

	"brickbot/internal/db"
)

// historyLimit is how many stored rows each model call sends (docs/chatbot.md → History).
const historyLimit = 20

// Roles stored in chat_messages.role.
const (
	roleUser      = "user"
	roleAssistant = "assistant"
)

var errNoPlainTurn = errors.New("history window has no plain user turn")

// window turns stored rows (oldest first) into API messages. It drops rows up
// to the first plain user turn, so the window never opens on an orphaned
// tool_result, and merges consecutive same-role rows, which only occur after
// a failed turn. Rows are never edited.
func window(rows []db.ChatMessage) ([]anthropic.MessageParam, error) {
	start := -1
	for i, r := range rows {
		if r.Role == roleUser && isPlain(r.Content) {
			start = i
			break
		}
	}
	if start < 0 {
		return nil, errNoPlainTurn
	}
	var out []anthropic.MessageParam
	for _, r := range rows[start:] {
		var blocks []anthropic.ContentBlockParamUnion
		if err := json.Unmarshal(r.Content, &blocks); err != nil {
			return nil, fmt.Errorf("decode chat message %d: %w", r.ID, err)
		}
		if n := len(out); n > 0 && string(out[n-1].Role) == r.Role {
			out[n-1].Content = append(out[n-1].Content, blocks...)
			continue
		}
		out = append(out, anthropic.MessageParam{Role: anthropic.MessageParamRole(r.Role), Content: blocks})
	}
	return out, nil
}

// blockTypes is enough of a stored content block to classify it.
type blockTypes []struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// isPlain reports whether content holds only text blocks (a visitor message,
// not a tool_result turn).
func isPlain(content []byte) bool {
	var blocks blockTypes
	if json.Unmarshal(content, &blocks) != nil || len(blocks) == 0 {
		return false
	}
	for _, b := range blocks {
		if b.Type != "text" {
			return false
		}
	}
	return true
}

// Line is one entry of the visitor-facing transcript.
type Line struct {
	ID        int64
	Role      string
	Text      string
	CreatedAt pgtype.Timestamptz
}

// transcript keeps plain user turns and the text of assistant turns; tool
// calls and tool results are internal.
func transcript(rows []db.ChatMessage) []Line {
	out := []Line{}
	for _, r := range rows {
		if r.Role == roleUser && !isPlain(r.Content) {
			continue
		}
		var blocks blockTypes
		if json.Unmarshal(r.Content, &blocks) != nil {
			continue
		}
		var parts []string
		for _, b := range blocks {
			if b.Type == "text" && b.Text != "" {
				parts = append(parts, b.Text)
			}
		}
		if len(parts) == 0 {
			continue
		}
		out = append(out, Line{ID: r.ID, Role: r.Role, Text: strings.Join(parts, "\n\n"), CreatedAt: r.CreatedAt})
	}
	return out
}

// textOnly keeps the text blocks of an assistant turn, so an incomplete
// tool_use (max_tokens, refusal) never enters the history.
func textOnly(blocks []anthropic.ContentBlockParamUnion) []anthropic.ContentBlockParamUnion {
	var out []anthropic.ContentBlockParamUnion
	for _, b := range blocks {
		if b.OfText != nil && b.OfText.Text != "" {
			out = append(out, b)
		}
	}
	return out
}

// appendMessage stores one turn. q may be bound to a transaction.
func appendMessage(ctx context.Context, q *db.Queries, sessionID pgtype.UUID, role string, blocks []anthropic.ContentBlockParamUnion) error {
	content, err := json.Marshal(blocks)
	if err != nil {
		return fmt.Errorf("encode %s turn: %w", role, err)
	}
	if _, err := q.CreateChatMessage(ctx, db.CreateChatMessageParams{SessionID: sessionID, Role: role, Content: content}); err != nil {
		return fmt.Errorf("store %s turn: %w", role, err)
	}
	return nil
}
