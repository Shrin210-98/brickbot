package chat

import (
	"context"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/packages/ssestream"
)

// Stream is the SDK's message event stream. Every Provider returns this exact
// type, so streamTurn decodes and accumulates events the same way whichever
// provider produced them.
type Stream = ssestream.Stream[anthropic.MessageStreamEventUnion]

// Provider makes one streamed model call.
type Provider interface {
	Stream(ctx context.Context, params anthropic.MessageNewParams) *Stream
}

// AnthropicProvider calls the Anthropic Messages API.
type AnthropicProvider struct {
	client anthropic.Client
}

// NewAnthropicProvider returns a Provider backed by client.
func NewAnthropicProvider(client anthropic.Client) *AnthropicProvider {
	return &AnthropicProvider{client: client}
}

// Stream implements Provider.
func (p *AnthropicProvider) Stream(ctx context.Context, params anthropic.MessageNewParams) *Stream {
	return p.client.Messages.NewStreaming(ctx, params)
}
