package chat

import (
	"context"
	"sync"
	"time"

	"brickbot/internal/services"
)

// catalogTTL bounds how stale the catalog summary in the system prompt may be.
// Tool calls always read the database directly.
const catalogTTL = 5 * time.Minute

// catalog caches the rendered system prompt (profile + catalog summary).
type catalog struct {
	profiles *services.ProfileService
	listings *services.ListingService
	now      func() time.Time

	mu     sync.Mutex
	prompt string
	at     time.Time
}

// systemPrompt returns the cached prompt, rebuilding it once catalogTTL has passed.
func (c *catalog) systemPrompt(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.prompt != "" && c.now().Sub(c.at) < catalogTTL {
		return c.prompt, nil
	}
	p, err := c.profiles.Get(ctx)
	if err != nil {
		return "", err
	}
	f, err := c.listings.Facets(ctx)
	if err != nil {
		return "", err
	}
	c.prompt = buildPrompt(p, f)
	c.at = c.now()
	return c.prompt, nil
}
