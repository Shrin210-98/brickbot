# BrickBot

A real estate web app for **one salesman**. It has public listings, an inquiry form, wa.me links, an admin area behind a single password, and a Claude chatbot that answers only from real listings and creates leads after the visitor consents.

- `backend/`: Go 1.27, net/http method-pattern router, Postgres 16, sqlc, Atlas. See `backend/CLAUDE.md`.
- `frontend/`: React 19, TS, Vite, Tailwind v4, shadcn/ui, TanStack Query. See `frontend/CLAUDE.md`.
- `docs/api.md`: every route. `docs/chatbot.md`: chatbot design and the SSE contract.

## Out of scope (do not build unless asked)
Multi-user auth/RBAC/multi-tenant · admin chat viewer · S3/R2 abstraction · Redis/queues · email/SMS notifications · UI i18n · WhatsApp Business Cloud API (wa.me links only).

## Docker only
Never use a host Go/Node/Atlas/sqlc toolchain. Everything goes through `make`:

| Target | Purpose |
|---|---|
| `make dev` / `down` / `logs s=api` | Run the stack (postgres :5432, api :8080, frontend :5173) |
| `make migrate` / `migrate-diff name=x` / `migrate-status` | Atlas |
| `make sqlc` | Regenerate `backend/internal/db` |
| `make seed` | Idempotent seed (profile + listings) |
| `make reset` | Wipe the volumes, then dev, migrate, seed (asks first) |
| `make test` / `make lint` | Must be green before a step is done |
| `make psql` | DB shell |
| `make shadcn c=<name>` | Add a shadcn component |

The Makefile exports `HOST_UID`/`HOST_GID` so containers write files owned by you.

## Working rules
- Build **one step at a time**, then stop and wait for an OK.
- List the files before editing several of them.
- After any `backend/db/schema.sql` change, run `make migrate-diff name=<x> && make migrate && make sqlc` in the **same** change. Never leave them out of sync.
- Update `docs/api.md` whenever a route is added, changed or removed.
- Never invent Anthropic model IDs. The model comes from `ANTHROPIC_MODEL` (default `claude-haiku-5-5`).
- YAGNI: no abstractions "for the future". No new dependencies without asking.
- JSON is `snake_case` end to end.
- Defaults: India / INR / sqft (configured in the profile row), local-disk media at `/media/`, no notifications, English UI.

## Env
- `.env` is gitignored, mode 600, never printed or committed.
- Only `.env.example` is committed; keep them in sync.
- Compose uses `HOST_UID`/`HOST_GID`, not `UID`/`GID`.

## Sandbox
- `aidev` is intentionally not in sudoers. Never attempt `sudo`.
- If a command fails with a permissions error, stop and ask — do not retry with `sudo`.

## Docs
- Update `docs/api.md` when a route changes.
- Update `docs/chatbot.md` when chatbot behavior, tools, or SSE events change.

## Git
- Never commit `.env`, `uploads/`, `node_modules/`, `pgdata/`.
- Never `git push --force`.
- Never `git reset --hard` without asking first.
- Do NOT push. Pushing is a manual decision the user makes.
- At the end of each step, **commit the work yourself** in the logical
  units described in the Commits section. Use `git add` with explicit
  paths — never `git add -A` or `git add .`.
- Output the list of commits you made (subject + hash) at the end of
  your step report.

## Commits
- Split commits by concern, not by step. A single step should produce
  several commits — one per logical unit.
- Typical split for a backend step:
    db (schema + migrations + queries + regenerated code)
    infra (config, middleware, auth, httpx)
    services
    handlers + routes
    seed
    tests
    docs + config files (.env.example, CLAUDE.md, go.mod)
- Typical split for a frontend step:
    build config (vite, ts, eslint, package.json)
    UI primitives (components/ui)
    types + api client
    pages + layout + components
    tests
    docs
- Order: dependencies first (db → types → services → handlers/pages → tests → docs).
- Each commit must build and pass `make lint` on its own.
- Conventional Commits: `type(scope): subject`.
- Body explains *why*, not just *what*.
- If a change is knowingly incomplete, prefix with `wip(...)`.
- Use `git add <explicit paths>` — never `git add -A` or `git add .`.
- Do NOT add Co-Authored-By lines. The user is the sole author.

## Reads
- Stay inside the project root. Do not read from `~/.claude/` or any
  path outside `/home/aidev/All Files/brickbot/`.
- If you need information from outside, ask.

## Command style
- Prefer single-purpose commands with absolute paths over compound commands
  (`cd X && cmd1 && cmd2`).
- Use the Read tool for reading files. If you must shell out, use
  `cat /absolute/path/file`.
- Do NOT read files outside the project root. If you need information from
  outside, ask.

## Never (in auto mode)
- Never read `.env`, `.env.*`, `*.key`, `*.pem`, `~/.ssh/*`, `~/.aws/*`.
- Never run `sudo`, `su`, or any command that needs elevated privileges.
- Never run `docker compose down -v` or `docker compose exec <svc> rm`.
- Never run `git push`, `git push --force`, or `git reset --hard`.
- Never modify the Makefile or `docker-compose.yml` without stopping first
  to ask.
- Never `git add -A` or `git add .` — always explicit paths.
- Never run `make reset`.