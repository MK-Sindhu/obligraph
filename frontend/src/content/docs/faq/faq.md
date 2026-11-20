---
title: FAQ
description: Short answers to common questions about Obligraph - offline mode, regulators, feed schedules, returns, coverage results, deleting data and self-hosting.
order: 1
---

### Does Obligraph work without Claude?

Yes. Without `ANTHROPIC_API_KEY`, or with `AI_MODE=offline`, a built-in offline engine handles everything. It extracts only sentences with mandatory language such as "shall" or "must", kept word for word, and assesses coverage by keyword overlap plus a check that time limits match. The Copilot shows retrieval summaries instead of written answers. The offline engine is deliberately conservative, so use Claude for production-grade extraction and gap analysis.

### Which regulators are covered?

Obligraph polls three feeds: RBI notifications, RBI press releases, and SEBI circulars and updates. The SEBI feed currently publishes no items, so SEBI documents are added by upload or pasted text. Platform admins can add documents from RBI, SEBI, IRDAI, PFRDA, IFSCA, MCA, FIU-IND, CERT-In and MeitY. What you see depends on what has been ingested into your instance's corpus. See [Regulator feeds](/docs/admin/regulator-feeds).

### How often are feeds checked?

On a schedule, not continuously. With Docker, the worker polls enabled feeds every `CRAWL_INTERVAL_MINUTES` (default 360) when `CRAWL_ENABLED=true`. On Vercel, the daily cron crawls them at 02:30 UTC. A platform admin can select **Run now** at any time.

### Can I add my own returns?

Yes. Admins and owners can use **Add a custom return** under **Filings → Returns catalogue**. The built-in catalogue entries are samples; check their forms, frequencies and due dates against current directions before relying on them. See [Calendar and filings](/docs/using/calendar-and-filings).

### Why is a requirement "partial"?

Open the obligation and read the rationale. Usually your policy addresses the subject but misses or weakens something, such as scope, a timeline or who is responsible. With the offline engine, a matching sentence that doesn't state the same time limit is rated partial. And if the assessment rated it covered but none of its quotes could be found word for word in your policy, it's downgraded to partial and the rationale says so. To fix it, update the policy, upload the new version and delete the old one. Each upload or deletion re-assesses your obligations.

### Why are my obligations "unassessed"?

Obligations stay unassessed until your organisation has at least one policy. After an upload, assessments run in the background. On Vercel they advance while someone is signed in, and the daily cron finishes the rest.

### Why don't I see any obligations?

Either the corpus has no in-force instruments that match your entity types, or your entity types are wrong. Check **Settings → Organisation**, and ask a platform admin to enable feeds or ingest the instruments you need.

### Why can't I move a task to Done?

If the task is linked to a high or critical obligation and maker-checker is on, it needs a checker's approval. Use **Submit for approval**. While a request is pending, the task's status is locked. See [Tasks and approvals](/docs/using/tasks-and-approvals).

### Is the demo data real?

No. The demo corpus is a set of illustrative sample circulars marked as samples, not official publications, and the demo organisation and its policies are samples too.

### How do I delete my data?

Admins and owners can delete policies, which removes their passages and re-assesses your obligations, and evidence, unless it backs an approved decision. Members can delete tasks. You can delete your own Copilot conversations. Admins can remove members, which doesn't delete their accounts. The app has no option to delete a whole organisation or a user account; ask whoever operates your instance. To erase a demo request, a platform admin uses the API, as described in [Demo requests](/docs/admin/demo-requests).

### Can I self-host?

Yes. Run it with [Docker](/docs/deploy/docker) on any machine or VM, or deploy it to your own [Vercel](/docs/deploy/vercel) and Postgres accounts.

### What is sent to Anthropic?

Only when Claude is on: the regulatory documents being extracted, the requirement and matching policy passages for each assessment, and your Copilot questions with the data the Copilot looks up. Evidence files and passwords are never sent. See [Security and data](/docs/security/security-and-data).
