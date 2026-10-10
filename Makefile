# Everything runs in containers. No host Go/Node/Atlas/sqlc required.
SHELL := /bin/bash
.DEFAULT_GOAL := help

export HOST_UID := $(shell id -u)
export HOST_GID := $(shell id -g)

COMPOSE := docker compose
TOOL    := $(COMPOSE) run --rm
SHADCN  := shadcn@4.21.0

.PHONY: help dev down logs migrate migrate-diff migrate-status sqlc seed reset test lint psql shadcn fetch-images

help: ## List targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

dev: ## Build and start postgres, api, frontend; wait until healthy
	$(COMPOSE) up -d --build --wait

down: ## Stop all services
	$(COMPOSE) down

logs: ## Follow logs (s=<service> to filter)
	$(COMPOSE) logs -f $(s)

migrate: ## Apply pending Atlas migrations
	$(TOOL) atlas migrate apply --env local

migrate-diff: ## Generate a migration from db/schema.sql (name=<x>)
	@test -n "$(name)" || { echo "usage: make migrate-diff name=<migration_name>"; exit 1; }
	$(TOOL) atlas migrate diff $(name) --env local

migrate-status: ## Show migration status
	$(TOOL) atlas migrate status --env local

sqlc: ## Regenerate internal/db from queries
	$(TOOL) sqlc generate

seed: ## Upsert seed profile + listings (idempotent)
	$(COMPOSE) exec api go run ./cmd/seed

reset: ## Wipe DB + uploads, then dev, migrate, seed (asks first)
	@read -r -p "Type 'reset' to wipe the database and uploads: " ans; [ "$$ans" = "reset" ] || { echo "aborted"; exit 1; }
	$(COMPOSE) down -v
	$(MAKE) dev
	$(MAKE) migrate
	$(MAKE) seed

test: ## Go tests (against brickbot_test) + frontend typecheck and vitest
	$(TOOL) atlas migrate apply --env test
	$(COMPOSE) exec api sh -c 'DATABASE_URL="$$TEST_DATABASE_URL" go test ./...'
	$(COMPOSE) exec frontend npm run typecheck
	$(COMPOSE) exec frontend npm test

lint: ## go vet + golangci-lint + eslint
	$(COMPOSE) exec api go vet ./...
	$(TOOL) golangci-lint golangci-lint run ./...
	$(COMPOSE) exec frontend npm run lint

psql: ## Open psql in the postgres container
	$(COMPOSE) exec postgres psql -U $${POSTGRES_USER:-brickbot} $${POSTGRES_DB:-brickbot}

shadcn: ## Add a shadcn component (c=<name>)
	@test -n "$(c)" || { echo "usage: make shadcn c=<component>"; exit 1; }
	$(COMPOSE) exec frontend npx --yes $(SHADCN) add --yes $(c)

fetch-images: ## Download licensed images listed in scripts/fetch-images.sh
	./scripts/fetch-images.sh
