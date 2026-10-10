// Package chat runs the visitor chatbot: catalog cache, tools, the Anthropic
// stream and tool loop, and append-only persistence. docs/chatbot.md is the spec.
package chat

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"sync"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"brickbot/internal/db"
	"brickbot/internal/services"
)

// maxIterations caps model calls per visitor message (docs/chatbot.md → Tool loop).
const maxIterations = 4

// Sink receives what a turn produces while it streams. The handler turns each
// call into an SSE event.
type Sink interface {
	Delta(text string)
	Tool(name string)
	Listings(items []services.ListingWithMedia)
	LeadCreated(inquiryID pgtype.UUID)
}

// Service is the chatbot. Its Provider is the Anthropic API, or the scripted
// EchoProvider in demo mode.
type Service struct {
	provider  Provider
	model     string
	pool      *pgxpool.Pool
	q         *db.Queries
	listings  *services.ListingService
	inquiries *services.InquiryService
	catalog   *catalog

	mu     sync.Mutex
	active map[[16]byte]struct{} // sessions with a turn in progress
}

// NewService returns a chatbot that calls model through provider.
func NewService(provider Provider, model string, pool *pgxpool.Pool,
	profiles *services.ProfileService, listings *services.ListingService, inquiries *services.InquiryService,
) *Service {
	return &Service{
		provider:  provider,
		model:     model,
		pool:      pool,
		q:         db.New(pool),
		listings:  listings,
		inquiries: inquiries,
		catalog:   &catalog{profiles: profiles, listings: listings, now: time.Now},
		active:    map[[16]byte]struct{}{},
	}
}

// CreateSession starts a conversation for visitorID.
func (s *Service) CreateSession(ctx context.Context, visitorID pgtype.UUID) (db.ChatSession, error) {
	sess, err := s.q.CreateChatSession(ctx, visitorID)
	if err != nil {
		return db.ChatSession{}, fmt.Errorf("create chat session: %w", err)
	}
	return sess, nil
}

// Transcript returns the visitor-facing transcript, or ErrNotFound unless
// visitorID owns the session.
func (s *Service) Transcript(ctx context.Context, id, visitorID pgtype.UUID) ([]Line, error) {
	if err := s.ownSession(ctx, id, visitorID); err != nil {
		return nil, err
	}
	rows, err := s.q.ListChatMessages(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("list chat messages: %w", err)
	}
	return transcript(rows), nil
}

// Lock claims the session for one turn: ErrNotFound unless visitorID owns
// it, ErrConflict while another turn runs. Call unlock when the turn ends.
func (s *Service) Lock(ctx context.Context, id, visitorID pgtype.UUID) (unlock func(), err error) {
	if err := s.ownSession(ctx, id, visitorID); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, busy := s.active[id.Bytes]; busy {
		return nil, fmt.Errorf("%w: a reply is already streaming for this conversation", services.ErrConflict)
	}
	s.active[id.Bytes] = struct{}{}
	return func() {
		s.mu.Lock()
		delete(s.active, id.Bytes)
		s.mu.Unlock()
	}, nil
}

// Reply stores the visitor's message, then runs the tool loop, streaming to
// sink. Call it while holding Lock. Errors wrapping ErrUpstream come from the
// model call.
func (s *Service) Reply(ctx context.Context, id pgtype.UUID, text string, sink Sink) error {
	if err := appendMessage(ctx, s.q, id, roleUser, []anthropic.ContentBlockParamUnion{anthropic.NewTextBlock(text)}); err != nil {
		return err
	}
	system, err := s.catalog.systemPrompt(ctx)
	if err != nil {
		return err
	}
	// Once the model has answered, store its turn even if the client has gone.
	store := context.WithoutCancel(ctx)

	for i := range maxIterations {
		rows, err := s.q.ListRecentChatMessages(ctx, db.ListRecentChatMessagesParams{SessionID: id, Limit: historyLimit})
		if err != nil {
			return fmt.Errorf("list chat history: %w", err)
		}
		slices.Reverse(rows)
		msgs, err := window(rows)
		if err != nil {
			return err
		}

		msg, err := s.streamTurn(ctx, system, msgs, i == maxIterations-1, sink)
		if err != nil {
			return err
		}
		turn := msg.ToParam().Content
		if msg.StopReason != anthropic.StopReasonToolUse {
			if blocks := textOnly(turn); len(blocks) > 0 {
				return appendMessage(store, s.q, id, roleAssistant, blocks)
			}
			return nil
		}

		results, err := s.runTools(ctx, id, msg, sink)
		if err != nil {
			return err
		}
		if err := s.appendToolRound(store, id, turn, results); err != nil {
			return err
		}
	}
	return nil
}

// runTools executes every tool_use block in order and returns one tool_result
// per call, for a single user turn.
func (s *Service) runTools(ctx context.Context, id pgtype.UUID, msg anthropic.Message, sink Sink) ([]anthropic.ContentBlockParamUnion, error) {
	var results []anthropic.ContentBlockParamUnion
	for _, block := range msg.Content {
		use, ok := block.AsAny().(anthropic.ToolUseBlock)
		if !ok {
			continue
		}
		out, err := s.runTool(ctx, id, use.Name, use.Input, sink)
		if te, ok := errors.AsType[toolError](err); ok {
			results = append(results, anthropic.NewToolResultBlock(use.ID, te.Error(), true))
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("run %s: %w", use.Name, err)
		}
		results = append(results, anthropic.NewToolResultBlock(use.ID, out, false))
	}
	return results, nil
}

// appendToolRound stores an assistant tool_use turn and its tool results
// together, so the history never holds one without the other.
func (s *Service) appendToolRound(ctx context.Context, id pgtype.UUID, turn, results []anthropic.ContentBlockParamUnion) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if err := appendMessage(ctx, q, id, roleAssistant, turn); err != nil {
			return err
		}
		return appendMessage(ctx, q, id, roleUser, results)
	})
}

func (s *Service) ownSession(ctx context.Context, id, visitorID pgtype.UUID) error {
	_, err := s.q.GetChatSession(ctx, db.GetChatSessionParams{ID: id, VisitorID: visitorID})
	if errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("%w: chat session", services.ErrNotFound)
	}
	if err != nil {
		return fmt.Errorf("get chat session: %w", err)
	}
	return nil
}
