# backend/

Go module `brickbot`. Dependencies point one way: **handlers → services → db**. Services never import `net/http`.

| Package | Responsibility |
|---|---|
| `cmd/api` | Wire config, pool, services, handlers; graceful shutdown |
| `cmd/seed` | Idempotent seed from `seed/*.json`; stores `ADMIN_EMAIL` and hashes `ADMIN_PASSWORD` only when the profile row is new |
| `internal/config` | Typed env config, fail fast (`SESSION_SECRET` ≥ 32 bytes) |
| `internal/auth` | Stateless HMAC session cookie (`bb_session`); no sessions table |
| `internal/db` | **sqlc output (never edit by hand)** + `pool.go` |
| `internal/services` | Business logic; domain errors `ErrNotFound`/`ErrConflict`/`ErrInvalid` |
| `internal/services/chat` | Catalog cache, tools, Anthropic stream and tool loop, persistence |
| `internal/handlers` | decode → `validate.Struct` (422) → service → response DTO |
| `internal/server` | All `mux.HandleFunc("METHOD /path", …)` registrations, middleware chain |
| `internal/middleware` | Request ID, logging, recover, RequireAdmin, rate limit, Origin check |
| `internal/httpx` | JSON helpers, error envelope, validator, pagination, SSE writer |

## Conventions
- Error envelope `{"error":{"code","message","fields?"}}`. Status mapping is in `docs/api.md`.
- Request DTOs carry `json` and `validate` tags. Field errors are keyed by JSON name.
- Never return sqlc structs from handlers. Map them to response DTOs.
- Allowed deps only: pgx/v5, validator/v10, anthropic-sdk-go, x/crypto (bcrypt), stdlib `uuid`.

## Database
- `db/schema.sql` is the source of truth. Workflow: edit it → `make migrate-diff name=x && make migrate && make sqlc`.
- No triggers. Every UPDATE query sets `updated_at = now()` explicitly.
- Optional filters use `(sqlc.narg('x')::type IS NULL OR col = sqlc.narg('x'))`.
- Only the `pg_trgm` extension is used. `gen_random_uuid()` is built in.

## Chatbot
Follow `docs/chatbot.md`:
- thinking disabled and effort low
- no `temperature`/`top_p`/`top_k` (Haiku 5.5 rejects them)
- no assistant prefill
- history is append-only, sending the last 20 rows that start on a plain user turn
- tool loop of at most 4 iterations

## Testing
`make test` runs `go test ./...` with `DATABASE_URL` pointed at the `brickbot_test` database (migrated first). Prefer table-driven tests.
DB-backed tests truncate every table, so they live only in `internal/handlers` (end-to-end through `server.Routes`); other packages keep pure unit tests so parallel package runs never collide.

## Handler shape
decode → validate.Struct (422 with `fields`) → service → map domain error
(ErrNotFound→404, ErrConflict→409, ErrInvalid→400) → write DTO. Never return
a sqlc struct.

## sqlc
`internal/db/*.go` is generated. Never edit it. Change `db/queries/*.sql`
and run `make sqlc`.

## Middleware order
RequestID → Logger → Recover → Origin check → RequireAdmin (admin mux) →
RateLimit → handler. SSE disables the write timeout via `http.ResponseController`.

## Atlas
Never invoke Atlas directly. Use `make migrate*`. Shadow DB `atlas_dev` is
created by `postgres/init/01-databases.sql`.
