package chat

import (
	"context"
	"errors"
	"fmt"

	"github.com/anthropics/anthropic-sdk-go"
)

// maxTokens caps one model call. Replies are short; this only guards runaways.
const maxTokens = 4096

// ErrUpstream marks a failed or broken Anthropic API call.
var ErrUpstream = errors.New("anthropic api")

// streamTurn runs one streamed model call. It forwards text deltas and tool
// starts to sink and returns the accumulated message. With last set the model
// may not call tools, so the final iteration always ends in text.
func (s *Service) streamTurn(ctx context.Context, system string, msgs []anthropic.MessageParam, last bool, sink Sink) (anthropic.Message, error) {
	params := anthropic.MessageNewParams{
		Model:     s.model, // anthropic.Model is a string alias
		MaxTokens: maxTokens,
		System:    []anthropic.TextBlockParam{{Text: system}},
		Messages:  msgs,
		Tools:     tools,
		// Haiku 5.5: thinking off is accepted at effort high or below; no sampling params.
		Thinking:     anthropic.ThinkingConfigParamUnion{OfDisabled: &anthropic.ThinkingConfigDisabledParam{}},
		OutputConfig: anthropic.OutputConfigParam{Effort: anthropic.OutputConfigEffortLow},
	}
	if last {
		params.ToolChoice = anthropic.ToolChoiceUnionParam{OfNone: &anthropic.ToolChoiceNoneParam{}}
	}

	stream := s.client.Messages.NewStreaming(ctx, params)
	defer func() { _ = stream.Close() }() // stream.Err carries any read error
	var msg anthropic.Message
	for stream.Next() {
		ev := stream.Current()
		if err := msg.Accumulate(ev); err != nil {
			return msg, fmt.Errorf("%w: accumulate stream: %w", ErrUpstream, err)
		}
		switch e := ev.AsAny().(type) {
		case anthropic.ContentBlockStartEvent:
			if e.ContentBlock.Type == "tool_use" {
				sink.Tool(e.ContentBlock.Name)
			}
		case anthropic.ContentBlockDeltaEvent:
			if d, ok := e.Delta.AsAny().(anthropic.TextDelta); ok && d.Text != "" {
				sink.Delta(d.Text)
			}
		}
	}
	if err := stream.Err(); err != nil {
		return msg, fmt.Errorf("%w: %w", ErrUpstream, err)
	}
	return msg, nil
}
