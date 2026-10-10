package chat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/mail"
	"regexp"
	"slices"
	"strings"
	"unicode/utf8"
	"uuid"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/jackc/pgx/v5/pgtype"

	"brickbot/internal/services"
)

// Tool names, also sent to the client in `tool` events.
const (
	toolSearch = "search_listings"
	toolGet    = "get_listing"
	toolLead   = "create_lead"
)

// searchLimit caps how many listings one search returns.
const searchLimit = 5

var (
	purposes      = []string{"sale", "rent"}
	propertyTypes = []string{"apartment", "house", "villa", "plot", "commercial", "other"}
	sorts         = []string{"newest", "price_asc", "price_desc"}
	// phoneRE matches httpx's `phone` validation tag used by the inquiry form.
	phoneRE = regexp.MustCompile(`^\+?[0-9][0-9 ()-]{5,18}[0-9]$`)
)

// tools are the tool definitions sent with every model call (docs/chatbot.md → Tools).
var tools = []anthropic.ToolUnionParam{
	tool(toolSearch,
		"Search the salesman's active listings. Every field is optional; send only what the visitor asked for. Returns at most 5 listings and the total number of matches.",
		map[string]any{
			"purpose":       map[string]any{"type": "string", "enum": purposes, "description": "sale or rent"},
			"property_type": map[string]any{"type": "string", "enum": propertyTypes},
			"city":          map[string]any{"type": "string", "description": "Exact city name"},
			"locality":      map[string]any{"type": "string", "description": "Exact locality name"},
			"min_price":     map[string]any{"type": "integer", "minimum": 0, "description": "In the profile currency; rent is per month"},
			"max_price":     map[string]any{"type": "integer", "minimum": 0, "description": "In the profile currency; rent is per month"},
			"min_bedrooms":  map[string]any{"type": "integer", "minimum": 0, "maximum": 50},
			"query":         map[string]any{"type": "string", "maxLength": 100, "description": "Free text matched against title, description, city and locality"},
			"sort":          map[string]any{"type": "string", "enum": sorts},
		}, nil),
	tool(toolGet,
		"Get one active listing by slug, with its description and address.",
		map[string]any{
			"slug": map[string]any{"type": "string", "description": "The listing slug from search_listings"},
		}, []string{"slug"}),
	tool(toolLead,
		"Record the visitor as a lead for the salesman. Only call this after the visitor has explicitly agreed, in this conversation, to share their contact details with the salesman. Needs a name and a phone number or an email.",
		map[string]any{
			"consent":      map[string]any{"type": "boolean", "description": "true only if the visitor explicitly agreed to share their contact details"},
			"name":         map[string]any{"type": "string", "maxLength": 100},
			"phone":        map[string]any{"type": "string", "description": "Required unless email is given"},
			"email":        map[string]any{"type": "string", "description": "Required unless phone is given"},
			"message":      map[string]any{"type": "string", "maxLength": 2000, "description": "What the visitor is looking for"},
			"listing_slug": map[string]any{"type": "string", "description": "The listing the visitor is interested in, if any"},
		}, []string{"consent", "name"}),
}

func tool(name, description string, props map[string]any, required []string) anthropic.ToolUnionParam {
	t := anthropic.ToolUnionParamOfTool(anthropic.ToolInputSchemaParam{Properties: props, Required: required}, name)
	t.OfTool.Description = anthropic.String(description)
	return t
}

// toolError is a failure the model can act on. It becomes a tool_result with
// is_error set; it never fails the turn.
type toolError string

func (e toolError) Error() string { return string(e) }

// runTool executes one tool_use block and returns the tool_result content.
// A toolError is reported to the model; any other error fails the turn.
func (s *Service) runTool(ctx context.Context, sessionID pgtype.UUID, name string, input json.RawMessage, sink Sink) (string, error) {
	switch name {
	case toolSearch:
		return s.searchListings(ctx, input, sink)
	case toolGet:
		return s.getListing(ctx, input, sink)
	case toolLead:
		return s.createLead(ctx, sessionID, input, sink)
	default:
		return "", toolError("Unknown tool " + name)
	}
}

type searchInput struct {
	Purpose      string `json:"purpose"`
	PropertyType string `json:"property_type"`
	City         string `json:"city"`
	Locality     string `json:"locality"`
	MinPrice     *int64 `json:"min_price"`
	MaxPrice     *int64 `json:"max_price"`
	MinBedrooms  *int64 `json:"min_bedrooms"`
	Query        string `json:"query"`
	Sort         string `json:"sort"`
}

func (in searchInput) validate() error {
	switch {
	case in.Purpose != "" && !slices.Contains(purposes, in.Purpose):
		return toolError("purpose must be sale or rent")
	case in.PropertyType != "" && !slices.Contains(propertyTypes, in.PropertyType):
		return toolError("property_type must be one of " + strings.Join(propertyTypes, ", "))
	case in.Sort != "" && !slices.Contains(sorts, in.Sort):
		return toolError("sort must be one of " + strings.Join(sorts, ", "))
	case negative(in.MinPrice) || negative(in.MaxPrice):
		return toolError("prices must not be negative")
	case in.MinBedrooms != nil && (*in.MinBedrooms < 0 || *in.MinBedrooms > 50):
		return toolError("min_bedrooms must be 0 to 50")
	case utf8.RuneCountInString(in.Query) > 100 || utf8.RuneCountInString(in.City) > 100 || utf8.RuneCountInString(in.Locality) > 100:
		return toolError("query, city and locality must be at most 100 characters")
	}
	return nil
}

func negative(p *int64) bool { return p != nil && *p < 0 }

// listingResult is the compact listing shape tools return to the model.
type listingResult struct {
	Slug         string `json:"slug"`
	Title        string `json:"title"`
	Purpose      string `json:"purpose"`
	PropertyType string `json:"property_type"`
	Price        int64  `json:"price"`
	Bedrooms     *int16 `json:"bedrooms"`
	Bathrooms    *int16 `json:"bathrooms"`
	Area         *int32 `json:"area"`
	City         string `json:"city"`
	Locality     string `json:"locality"`
	Description  string `json:"description,omitempty"`
	Address      string `json:"address,omitempty"`
}

func toResult(l services.ListingWithMedia, detail bool) listingResult {
	r := listingResult{
		Slug: l.Slug, Title: l.Title, Purpose: l.ListingType, PropertyType: l.PropertyType,
		Price: l.Price, Bedrooms: l.Bedrooms, Bathrooms: l.Bathrooms, Area: l.Area,
		City: l.City, Locality: l.Locality,
	}
	if detail {
		r.Description, r.Address = l.Description, l.Address
	}
	return r
}

func (s *Service) searchListings(ctx context.Context, input json.RawMessage, sink Sink) (string, error) {
	var in searchInput
	if err := decodeInput(input, &in); err != nil {
		return "", err
	}
	if err := in.validate(); err != nil {
		return "", err
	}
	rows, total, err := s.listings.List(ctx, services.ListingFilter{
		Purpose: in.Purpose, PropertyType: in.PropertyType, City: in.City, Locality: in.Locality,
		Q: in.Query, MinPrice: in.MinPrice, MaxPrice: in.MaxPrice, MinBedrooms: in.MinBedrooms, Sort: in.Sort,
	}, 1, searchLimit)
	if errors.Is(err, services.ErrInvalid) {
		return "", toolError("min_price must not exceed max_price")
	}
	if err != nil {
		return "", err
	}
	if len(rows) > 0 {
		sink.Listings(rows)
	}
	results := make([]listingResult, len(rows))
	for i, l := range rows {
		results[i] = toResult(l, false)
	}
	return encodeResult(map[string]any{"total": total, "listings": results})
}

func (s *Service) getListing(ctx context.Context, input json.RawMessage, sink Sink) (string, error) {
	var in struct {
		Slug string `json:"slug"`
	}
	if err := decodeInput(input, &in); err != nil {
		return "", err
	}
	if in.Slug == "" {
		return "", toolError("slug is required")
	}
	l, err := s.listings.GetBySlug(ctx, in.Slug)
	if errors.Is(err, services.ErrNotFound) {
		return "", toolError("No active listing with that slug")
	}
	if err != nil {
		return "", err
	}
	sink.Listings([]services.ListingWithMedia{l})
	return encodeResult(toResult(l, true))
}

type leadInput struct {
	Consent     *bool  `json:"consent"`
	Name        string `json:"name"`
	Phone       string `json:"phone"`
	Email       string `json:"email"`
	Message     string `json:"message"`
	ListingSlug string `json:"listing_slug"`
}

// validate trims the input and applies the inquiry form's rules (docs/api.md
// → POST /api/inquiries), after checking consent.
func (in *leadInput) validate() error {
	if in.Consent == nil || !*in.Consent {
		return toolError("Ask the visitor for consent first")
	}
	in.Name, in.Phone, in.Email = strings.TrimSpace(in.Name), strings.TrimSpace(in.Phone), strings.TrimSpace(in.Email)
	in.Message, in.ListingSlug = strings.TrimSpace(in.Message), strings.TrimSpace(in.ListingSlug)
	switch n := utf8.RuneCountInString(in.Name); {
	case n == 0:
		return toolError("name is required")
	case n > 100:
		return toolError("name must be at most 100 characters")
	}
	if in.Phone == "" && in.Email == "" {
		return toolError("A phone number or an email is required")
	}
	if in.Phone != "" && !phoneRE.MatchString(in.Phone) {
		return toolError("phone is not a valid phone number")
	}
	if in.Email != "" {
		addr, err := mail.ParseAddress(in.Email)
		if err != nil || addr.Address != in.Email || len(in.Email) > 254 {
			return toolError("email is not a valid email address")
		}
	}
	if utf8.RuneCountInString(in.Message) > 2000 {
		return toolError("message must be at most 2000 characters")
	}
	return nil
}

func (s *Service) createLead(ctx context.Context, sessionID pgtype.UUID, input json.RawMessage, sink Sink) (string, error) {
	var in leadInput
	if err := decodeInput(input, &in); err != nil {
		return "", err
	}
	if err := in.validate(); err != nil {
		return "", err
	}
	inq, err := s.inquiries.CreateFromChat(ctx, sessionID, services.NewInquiry{
		Name: in.Name, Phone: in.Phone, Email: in.Email, Message: in.Message, ListingSlug: in.ListingSlug,
	})
	switch {
	case errors.Is(err, services.ErrNotFound):
		return "", toolError("No active listing with that slug")
	case errors.Is(err, services.ErrConflict):
		return "", toolError("A lead was already recorded for this conversation")
	case err != nil:
		return "", err
	}
	sink.LeadCreated(inq.ID)
	return encodeResult(map[string]string{"inquiry_id": uuid.UUID(inq.ID.Bytes).String()})
}

func decodeInput(input json.RawMessage, v any) error {
	if err := json.Unmarshal(input, v); err != nil {
		return toolError("Invalid tool input: " + err.Error())
	}
	return nil
}

func encodeResult(v any) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "", fmt.Errorf("encode tool result: %w", err)
	}
	return string(b), nil
}
