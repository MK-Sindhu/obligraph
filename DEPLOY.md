# Deploying Obligraph to Vercel

Obligraph deploys as **two Vercel projects from this one repository**:

| Project | Root Directory | What it is |
|---|---|---|
| `obligraph-web` | `frontend` | Next.js site and app (marketing pages, dashboard, API proxy) |
| `obligraph-api` | `backend` | FastAPI on Vercel's Python runtime (`backend/index.py`) |

The browser only ever talks to `obligraph-web`. Its `/api/*` routes proxy to `obligraph-api`.

On Vercel the backend switches itself into **serverless mode** (detected from `VERCEL=1`):

- **Database setup:** migrations, LangGraph's tables and reference data are applied on cold start, so there's no manual migrate step.
- **Signing secret:** if `JWT_SECRET` isn't set, one is generated once and stored in the database.
- **Evidence files:** these are stored in Postgres, because Vercel has no persistent disk.
- **Queued work** (extraction, gap assessment) runs inside the request that queued it, up to about 20 s. The app advances anything left over in the background while someone is signed in, and a daily cron catches the rest.
- **Uploads** are capped at 4 MB, because Vercel limits request bodies to 4.5 MB.

## 1. Create the database

Use any Postgres 15+ with the `pgvector` extension. The simplest option is **Neon from the Vercel Marketplace**:

1. In the Vercel dashboard, go to **Storage → Create → Neon (Postgres)**.
2. Connect it to the `obligraph-api` project (step 2). This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` automatically.

Obligraph accepts the URLs exactly as Neon gives them (`postgres://…?sslmode=require`, including the pooled `-pooler` host). Supabase and other providers work too: paste their connection string as `DATABASE_URL`.

## 2. Create the API project

1. **Add New → Project**, then import this repository.
2. Set **Root Directory** to `backend`. Vercel detects FastAPI from `pyproject.toml`.
3. Add the environment variables below, then **Deploy**.

| Variable | Required | Value |
|---|---|---|
| `DATABASE_URL` | yes | Set by the Neon integration, or paste your connection string |
| `DATABASE_URL_UNPOOLED` | recommended | Direct (non-pooled) URL, used for migrations. Neon sets this for you |
| `ADMIN_EMAIL` | recommended | Your email. Only this address becomes platform admin. Without it, **the first person to register does** |
| `ANTHROPIC_API_KEY` | optional | Turns on Claude for extraction, gap analysis and the Copilot. Without it the offline engine runs |
| `CRON_SECRET` | optional | A random string of 16+ characters. Enables the daily cron (housekeeping, feed crawls, leftover jobs) |
| `JWT_SECRET` | optional | Set it to control the signing key yourself. Otherwise one is generated |
| `PUBLIC_URL` | for SSO | Your web URL, e.g. `https://obligraph.example.com` |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | for SSO | Register the redirect URI `<PUBLIC_URL>/api/auth/sso/callback` with your provider |
| `SEED_DEMO` | optional | `true` loads the sample corpus and a demo org on first start, into an empty database only: once any organisation exists it is skipped, so set it before anyone registers. The demo account is a public platform admin, so set `ADMIN_EMAIL` too, and don't use this on a site real users rely on |

Note the deployment URL, e.g. `https://obligraph-api.vercel.app`, and check `<that URL>/ready`.

## 3. Create the web project

1. **Add New → Project**, then import **the same repository** again.
2. Set **Root Directory** to `frontend`. Vercel detects Next.js.
3. Add one environment variable, then **Deploy**:

| Variable | Value |
|---|---|
| `OBLIGRAPH_API_URL` | The API project's URL from step 2, e.g. `https://obligraph-api.vercel.app` |

Open the web URL, register with your `ADMIN_EMAIL`, and you're the platform admin.

## 4. After the first deploy

- **Regulator feeds:** go to **Admin → Sources**, enable the RBI feeds, and click **Run now**.
- **Cron:** `backend/vercel.json` schedules `/api/internal/cron` daily at 02:30 UTC (08:00 IST). On the Hobby plan, Vercel only allows daily crons. On Pro you can make it more frequent (e.g. `*/15 * * * *`).
- **Custom domain:** add it to the web project, and update `PUBLIC_URL` on the API project if you use SSO.
- **Turning Claude on later:** add `ANTHROPIC_API_KEY` to the API project and redeploy. New documents use Claude from then on. Re-run "Re-assess all" on the obligations page to refresh existing assessments.

## Limits to know

- **Function time:** 300 s per request on Hobby (`maxDuration` is set to 300). Long Claude runs are processed in steps.
- **Uploads:** 4 MB per file. Larger documents need splitting, or a deployment outside Vercel (Docker has a 25 MB limit).
- **Rate limits** (login, demo form) are kept per instance. For strict limits across many instances, add one at the edge, such as Vercel Firewall rules.
- **Pricing:** Vercel and Neon have free tiers that run Obligraph. Check both pricing pages before going to production.

## Other hosts

`docker compose up --build` runs the same app on any VM, with a long-running worker and local file storage. See the README.
