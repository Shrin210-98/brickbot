package httpx

// Pagination defaults: ?page=1&page_size=20, page_size capped by validation.
const (
	DefaultPage     = 1
	DefaultPageSize = 20
	MaxPageSize     = 100
)

// Page is the paginated response shape:
// {"items": [...], "total": 0, "page": 1, "page_size": 20}.
type Page[T any] struct {
	Items    []T   `json:"items"`
	Total    int64 `json:"total"`
	Page     int64 `json:"page"`
	PageSize int64 `json:"page_size"`
}
