.PHONY: help up down db dev api worker web seed test lint format reset-db crawl

help:            ## Show targets
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

up:              ## Run the whole stack in Docker (db, api, worker, web) with demo data
	docker compose up --build -d
	@echo "Web: http://localhost:3000  API: http://localhost:8000/docs  login demo@obligraph.dev / obligraph-demo"

down:            ## Stop the Docker stack
	docker compose down

db:              ## Start only Postgres (pgvector) on localhost:5442
	docker compose up -d db

seed: db         ## Migrate and load sources, sample corpus and demo org
	cd backend && uv run alembic upgrade head && uv run obligraph seed --demo

api: db          ## Run the API (with in-process worker) on :8000
	cd backend && uv run uvicorn obligraph.api.app:app --reload --port 8000

worker:          ## Run a standalone job worker
	cd backend && uv run obligraph worker

web:             ## Run the frontend dev server on :3000 (expects the API on :8000)
	cd frontend && OBLIGRAPH_API_URL=http://localhost:8000 npm run dev

crawl:           ## Crawl enabled regulator feeds once
	cd backend && uv run obligraph crawl

test: db         ## Backend tests (uses the obligraph_test database)
	cd backend && uv run pytest -q

lint:            ## Lint backend and frontend
	cd backend && uv run ruff check . && uv run ruff format --check .
	cd frontend && npm run lint

format:          ## Auto-format backend
	cd backend && uv run ruff format . && uv run ruff check --fix .

reset-db:        ## Drop and recreate the dev database schema (destroys local data)
	docker compose exec db psql -U obligraph -d obligraph -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	cd backend && uv run alembic upgrade head
