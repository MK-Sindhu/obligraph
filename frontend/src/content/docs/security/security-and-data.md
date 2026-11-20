---
title: Security and data
description: How Obligraph separates organisations, controls access, protects evidence and passwords, logs activity, and what reaches Anthropic when Claude is on.
order: 1
---

## Tenant isolation

Obligraph keeps everything in one Postgres database. The regulatory corpus (documents, regulations, requirements, knowledge graph) is shared by every organisation on the instance. Your own data (obligations, tasks, policies, evidence, alerts, Copilot conversations, activity log) carries your organisation's ID, and every API query for it filters on the organisation you're working in, after checking you're a member.

Search keeps the two apart: regulation search covers only the shared corpus, and policy search covers only your organisation's documents.

## Access

- Every request checks your [role](/docs/admin/roles).
- Signing in issues an access token signed with `JWT_SECRET` (HS256) that expires after 24 hours.
- Sign-in and registration are limited to 20 attempts per IP address per 5 minutes, per API instance.
- [Single sign-on](/docs/admin/sso) uses OpenID Connect with PKCE.

If `JWT_SECRET` is empty, Docker and local installs use a built-in development secret, and Vercel deployments generate one and store it in the database. Set a long random value on any shared deployment.

## Passwords and evidence

Passwords are hashed with bcrypt, with a random salt for each password, and never stored in plain text. New passwords must be at least 8 characters. Accounts created through SSO get a random password.

Evidence files are hashed with SHA-256 at upload, never changed afterwards, and checked against that hash on every download and when the audit pack is built. See [Evidence and audit pack](/docs/using/evidence-and-audit-pack).

## Activity log

Each change is recorded in the same database transaction as the change itself: who acted, what they did, to which item, and when. This covers policies, obligations, tasks, assessments, approvals, evidence, filings, members and organisation settings, as well as audit pack downloads and printable board packs. See it under **Settings → Activity log**, or download it as a CSV export.

Model calls are traced for platform admins (purpose, model, token counts, latency, outcome, errors). The trace doesn't store prompts or answers.

## Data sent to Anthropic

When Claude is on (`ANTHROPIC_API_KEY` is set, or `AI_MODE=claude`), Obligraph sends this to Anthropic's API:

| Feature | What's sent |
|---|---|
| Extraction | The full text of each regulatory document being ingested, with its title and published date |
| Gap analysis | The requirement with its regulator, instrument reference, severity, source sentence and expected evidence, plus up to six passages from your policies with their document titles |
| Copilot | Your question, the conversation so far, and the tool results: regulation passages, your obligations, tasks and deadlines, policy passages and your organisation profile |

Evidence files, passwords and the activity log aren't part of any model request.

With `AI_MODE=offline`, or without a key, everything runs on the built-in offline engine inside the API and no model provider is called. Optional semantic search (`EMBEDDINGS_PROVIDER=fastembed`) also computes its embeddings in the API process.

## Self-hosting

Run Obligraph on your own infrastructure with [Docker](/docs/deploy/docker), or on your own [Vercel](/docs/deploy/vercel) and database accounts. On any public deployment, set `JWT_SECRET` and `ADMIN_EMAIL`, and don't load the public demo account.
