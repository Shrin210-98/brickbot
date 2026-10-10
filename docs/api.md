# BrickBot HTTP API

Base path: `/api`. JSON in and out, `snake_case` field names. Updated whenever a route is added, changed or removed.

## Conventions

**Error envelope** (every non-2xx response):

```json
{"error": {"code": "validation_failed", "message": "Request validation failed", "fields": {"email": "must be a valid email"}}}
```

| Status | `code` | When |
|---|---|---|
| 400 | `bad_request` | Malformed JSON / query params |
| 401 | `unauthorized` | Missing or invalid admin cookie |
| 404 | `not_found` | Resource does not exist (or is not public) |
| 409 | `conflict` | Unique violation, concurrent chat stream |
| 413 | `payload_too_large` | Body / upload over limit |
| 422 | `validation_failed` | Struct validation failed; see `fields` |
| 429 | `rate_limited` | Rate limit exceeded |
| 500 | `internal` | Unexpected server error |
| 503 | `unavailable` | Chatbot disabled (no API key) |

**Pagination:** `?page=1&page_size=20` → `{"items": [...], "total": 0, "page": 1, "page_size": 20}`.

## Public

### `GET /api/healthz`
Liveness + DB check. `200 {"status":"ok"}`.
*(Step 1: static response; DB ping added in step 3.)*
