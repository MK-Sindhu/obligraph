---
title: Run with Docker
description: Run Obligraph on your own machine or VM with Docker Compose - the services, ports, environment, demo data and where data is stored.
order: 2
---

`docker-compose.yml` at the root of the repository runs the whole stack: Postgres, the API, a background worker and the web app.

## Services

| Service | Image or build | Host port | What it does |
|---|---|---|---|
| `db` | `pgvector/pgvector:pg16` | `127.0.0.1:5442` | Postgres 16 with pgvector. Also creates an `obligraph_test` database for the test suite |
| `api` | `./backend` | `127.0.0.1:8000` | Applies migrations, runs the demo seed, then serves the FastAPI app |
| `worker` | `./backend` | None | Runs `obligraph worker`: queued jobs, housekeeping every 15 minutes, and feed polling when enabled |
| `web` | `./frontend` | `127.0.0.1:3000` | The Next.js app. Its `/api/*` routes proxy to `http://api:8000` |

Ports are bound to `127.0.0.1`, so they're reachable only from the host machine.

## Start

```bash
cp .env.example .env    # optional: add ANTHROPIC_API_KEY to enable Claude
make up                 # runs: docker compose up --build -d
```

- Web app: `http://localhost:3000`
- API docs: `http://localhost:8000/docs`

Stop the stack with `make down`. To start only the database, for local development, run `docker compose up -d db`.

## Environment

The `api` and `worker` services read `.env` if it exists; every variable in `.env.example` is optional for local use. The compose file itself sets `DATABASE_URL` and `STORAGE_DIR=/data` for both, plus `PUBLIC_URL=http://localhost:3000` and `RUN_WORKER_IN_API=false` for the API. Edit `docker-compose.yml` to change those.

Settings you're most likely to change in `.env`:

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Token-signing key. Set a long random value outside local development. If it's empty, a built-in development secret is used |
| `ADMIN_EMAIL` | The address that becomes platform admin when it registers |
| `ANTHROPIC_API_KEY`, `AI_MODE` | Turn Claude on (`auto` uses it when a key is set), or force `claude` or `offline` |
| `CRAWL_ENABLED`, `CRAWL_INTERVAL_MINUTES` | Poll enabled regulator feeds. Off by default; every 360 minutes when on |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | Single sign-on. See [SSO](/docs/admin/sso) |
| `MAX_UPLOAD_MB` | Upload limit for policies, evidence and ingested files (default 25) |
| `TIMEZONE` | Business timezone for "today", deadlines and overdue checks (default `Asia/Kolkata`) |

## Demo data

The API container runs `obligraph seed --demo` every time it starts. The seed only adds what's missing. It loads:

- the regulator sources (disabled) and the sample returns catalogue;
- a set of illustrative sample circulars, marked as samples and not official publications;
- a demo NBFC, **Demo Finance Ltd** (Middle Layer), with sample policies and filing history.

Sign in as `demo@obligraph.dev` with the password `obligraph-demo`.

The demo account is a platform admin and its password is public, so don't expose this stack as it is. Because the demo account already exists, the first account you register won't become platform admin automatically. Set `ADMIN_EMAIL` before registering your own account.

## Where data lives

| Data | Location |
|---|---|
| Database: corpus, organisations, obligations, tasks, policies, activity log | The `obligraph-db` volume |
| Evidence files | The `obligraph-files` volume, under `/data/evidence/<org id>/<evidence id>` |

Policy documents are stored as text in the database. Evidence is kept on local disk, so use a durable volume in production.
