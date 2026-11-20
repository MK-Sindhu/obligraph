# Obligraph

Regulatory obligations intelligence for Indian financial institutions.

Obligraph watches regulators (RBI, SEBI and others), turns each circular into discrete,
checkable requirements, links instruments in a knowledge graph (what amends or supersedes
what), works out which requirements bind *your* organisation, checks your policies against
them with verbatim evidence, and turns the gaps into dated tasks on a compliance calendar.
A Copilot answers questions over all of it, with citations.

## Features

| Area | What it does |
|---|---|
| Monitoring | Polls regulator RSS feeds, fetches each item (HTML or PDF), de-duplicates by content. Manual upload/ingest for anything else. |
| Extraction | Claude turns a document into metadata, requirements (kind, severity, frequency, deadline, evidence expected) and lineage links. Validated against Pydantic schemas before it touches the database. |
| Knowledge graph | Regulations, regulators, entity types, topics and parent Acts as nodes; `ISSUED_BY`, `APPLIES_TO`, `COVERS`, `DERIVED_FROM`, `AMENDS`, `SUPERSEDES`, `REFERENCES` as edges. Lineage timelines and "what was in force on date X". |
| Applicability | Each org declares its entity types (NBFC, bank, payment aggregator, AIF, ...). Matching requirements become obligations automatically, and obligations from superseded instruments are retired automatically. |
| Gap analysis | For each obligation, the most relevant passages of the org's policies are retrieved and assessed as covered / partial / missing. Every quote is verified to appear verbatim in the policy, and an unverifiable "covered" is downgraded. |
| Work | AI-suggested remediation tasks, a task board, a compliance calendar (hard deadlines, recurring obligations, statutory filings, task due dates), a risk heatmap (topic or regulator x severity), alerts, and an activity log. |
| Maker-checker | High-impact tasks can't be closed by one person. A checker approves or rejects with a note, and unanswered requests escalate automatically from admins to owners when the SLA lapses. The workflow is a **LangGraph** state machine checkpointed in Postgres. |
| Evidence & audit | Immutable evidence files (SHA-256 recorded and verified on every download) attached to tasks, obligations and filings. CSV export of every register, and a one-click audit-pack zip with a hash manifest for inspections. |
| Filings | A returns catalogue (sample entries, plus your own) generating per-period filings on the Indian financial year, with filed / late / overdue / waived tracking and acknowledgement evidence. |
| Readiness | DPDP, CERT-In and KYC/AML packs with a readiness score and top gaps. An NBFC **scale-based regulation** view shows which requirements apply at each layer and what moving up a layer adds. |
| Board pack | A dated report for the Board or CCO: KPIs, a written narrative, a coverage trend, ageing of gaps, new instruments, missed filings and ownership concentration. Printable as HTML or PDF. |
| SSO | OpenID Connect sign-in (authorisation code with PKCE). Users join the org whose `sso_domain` matches their verified email. |
| Copilot | A tool-using agent over the corpus and the org's own data: search, lineage tracing, in-force-on-date, obligations, tasks, deadlines and policies. It streams its answers, keeps conversation history, and cites its sources. |
| Multi-tenant | Organisations, members, roles (owner / admin / member / viewer), tenant-scoped queries throughout, and a platform-admin console. |
| Operations | Durable Postgres job queue with retries; every model call is traced (tokens, cache hits, latency, stop reason). |

## Quick start (Docker)

```bash
cp .env.example .env          # optional: add ANTHROPIC_API_KEY to enable Claude
make up                       # db + api + worker + web, seeded with demo data
```

- Web app: http://localhost:3000. Sign in as `demo@obligraph.dev` / `obligraph-demo`.
- API docs: http://localhost:8000/docs

The demo seeds seven **illustrative sample circulars** (marked as samples, not official
publications) chosen to show an amendment, a supersession, entity-type filtering and
policy gaps, plus a demo NBFC with three policies.

## Local development

Requirements: Docker, [uv](https://docs.astral.sh/uv/), Node.js 20+.

```bash
make db        # Postgres + pgvector on localhost:5442
make seed      # migrate, then load sources, the sample corpus and the demo org
make api       # API on :8000, with an in-process job worker
make web       # Next.js on :3000 (in another terminal)
make test      # backend tests against the obligraph_test database
```

Useful CLI commands (run inside `backend/`):

```bash
uv run obligraph crawl --source rbi_notifications   # crawl a feed now
uv run obligraph ingest circular.pdf --regulator RBI  # ingest a local file
uv run obligraph worker                              # standalone worker
```

## AI modes

`AI_MODE=auto` (the default) uses Claude when `ANTHROPIC_API_KEY` is set. Otherwise it
falls back to a deterministic offline engine, so the whole product, including its tests,
runs without a key:

| | Claude (`claude-opus-5-5`) | Offline engine |
|---|---|---|
| Extraction | Structured outputs; splits compound requirements; normalises entity types | Sentences with mandatory modals ("shall", "must"), kept verbatim; rule-based kind/severity/frequency/deadline |
| Gap analysis | Judges scope, timelines and responsibilities; quotes verified verbatim | Lexical overlap, plus a check that the policy states the same time limit ("6 hours" vs "24 hours" is a gap) |
| Copilot | Multi-turn agent with 9 tools | A clearly labelled retrieval summary of the most relevant sources |

Claude requests use adaptive thinking with per-workload effort (`EFFORT_*`), prompt caching
on the stable system prompt and tools, and server-side refusal fallbacks. Every call is
recorded in `llm_calls`, which is visible on the admin page.

## Architecture

```
 Next.js (frontend/)  --/api/* proxy-->  FastAPI (backend/obligraph/api)
                                             |
                    +------------------------+-------------------------+
                    |                        |                         |
             ingest/ (feeds,          compliance/ (applicability,   ai/ (Claude client,
             documents, pipeline)     assessment, calendar,          offline engine,
                    |                 dashboard)                     copilot + tools)
                    +-------------> Postgres 16 + pgvector <-----------+
                                    corpus . graph . tenant data . jobs . traces
                                             ^
                                   jobs.py worker (in-process or `obligraph worker`)
```

- **One database.** Full-text search (`tsvector`) and optional vector search (`pgvector`,
  local `fastembed` embeddings) are fused with reciprocal rank fusion. The graph lives in
  `graph_nodes` / `graph_edges` and is walked with recursive CTEs.
- **Jobs in the same transaction as the data** (`FOR UPDATE SKIP LOCKED`), so a crash never
  leaves a document without its processing job.
- **Copilot history is append-only.** Each API message is stored verbatim and replayed
  unchanged, so follow-ups keep their context.

```
backend/
  obligraph/
    api/            FastAPI app, routes, schemas, auth dependencies
    ai/             claude.py (client + tracing), extract, offline engine, copilot, tools, prompts
    compliance/     obligations (applicability, SBR), assess (gap analysis), approvals (LangGraph),
                    evidence, exports, filings, packs, report (board pack), calendar, dashboard,
                    housekeeping
    sso.py          OpenID Connect sign-in
    ingest/         sources (RSS crawler), documents (pdf/docx/html), pipeline
    graph.py        knowledge graph operations
    search.py       hybrid search
    jobs.py         durable job queue + worker
    models.py       schema; migrations/ holds the Alembic history
    fixtures/       sample circulars and demo policies
  tests/            unit, end-to-end HTTP, Claude-path (scripted client), crawler
frontend/           Next.js app
```

## Workflows and background work

- **Approvals** (`compliance/approvals.py`): `submit -> notify -> wait_for_checker -> approve | reject | withdraw`, with `escalate` looping back to the wait. Each request is a LangGraph thread (`thread_id` = approval id) checkpointed by `langgraph-checkpoint-postgres`, so it can wait for days and survive restarts. Rule checks (the maker can't approve their own work, required role per level, a rejection needs a reason) happen before the graph is resumed.
- **Housekeeping** (every 15 minutes in the worker): escalates approvals past their SLA, raises overdue-task alerts (once a day per task), generates upcoming filings, and records the daily coverage snapshot used for board-pack trends.

## Configuration

See [`.env.example`](.env.example). The main settings are `DATABASE_URL`, `JWT_SECRET`
(set a long random value outside local development), `ANTHROPIC_API_KEY`, `AI_MODE`,
`EMBEDDINGS_PROVIDER` (`fastembed` after `uv sync --extra embeddings`) and `CRAWL_ENABLED`.

Evidence files are stored under `STORAGE_DIR` (`/data` in Docker, on the `obligraph-files`
volume). For SSO, set `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` and `PUBLIC_URL`,
and register `<PUBLIC_URL>/api/auth/sso/callback` as the redirect URI with your provider.

Regulator sources are seeded **disabled**. Enable them on the admin page, then either set
`CRAWL_ENABLED=true` for scheduled polling or use "Run now".

## Known limitations

- The SEBI RSS feed currently publishes no items, so SEBI coverage relies on manual ingest
  until a working feed or scraper is added. The RBI notification and press-release feeds work.
- Offline-engine extraction is intentionally conservative. Use Claude for production-grade
  extraction and gap analysis.
- The returns catalogue and the DPDP / CERT-In / SBR fixtures are **samples**. Verify forms,
  frequencies and due dates against current directions before relying on them, and add your
  own return types for the real schedule.
- Evidence is stored on local disk. Use a durable volume, or swap in object storage, in
  production.
