---
title: Policies and gap analysis
description: Uploading policy documents, supported formats and size limits, duplicate detection, passages, and how coverage is assessed with or without Claude.
order: 1
---

Obligraph judges coverage against the policies you upload. Only admins and owners can upload or delete policies; everyone in the organisation can see the list.

## Uploading

On **Policies**, use **Upload a policy**. You can give a title; otherwise Obligraph uses the document's first line if it's a Markdown heading, or else the file name.

| Format | Notes |
|---|---|
| PDF (`.pdf`) | Must contain extractable text. Scanned images are rejected |
| Word (`.docx`) | |
| Text and Markdown (`.txt`, `.md`) | |
| HTML (`.html`, `.htm`) | |

The size limit is set on the API: 25 MB by default, 4 MB on serverless hosts such as Vercel, or the value of `MAX_UPLOAD_MB` if it's set. Larger files are refused.

## Duplicate detection

Each policy is fingerprinted with a SHA-256 hash of its text, with whitespace normalised. If the text matches a policy your organisation already has, the upload is refused and the message names the existing policy. Other organisations' documents aren't compared.

## Passages

Each policy is split on paragraph boundaries into passages of about 1,200 characters, with a small overlap, and indexed for search. The **Passages** column shows how many a policy has. Assessments retrieve and quote passages, not whole documents.

Uploading or deleting a policy queues a re-assessment of every obligation. Results appear on **Obligations** as each one finishes.

## How assessment works

For each obligation, Obligraph searches your policies for the six passages most relevant to the requirement and the evidence it expects. An engine returns a verdict (covered, partial or missing), a confidence, a rationale, suggested remediation, quotes and up to three suggested tasks. Quotes are checked against the passages before anything is saved. See [Obligations and coverage](/docs/concepts/obligations-and-coverage).

| | Claude | Offline engine |
|---|---|---|
| How it judges | Weighs scope, timelines and responsibilities against the requirement | Keyword overlap between the requirement and the passages |
| Time limits | Part of the judgement | A matching sentence without the same time limit ("6 hours" vs "24 hours") is rated partial |
| What leaves your deployment | The requirement and the retrieved policy passages go to Anthropic's API | Nothing; it runs inside the API |
| Label on the obligation | Claude | Offline heuristic |

Claude is used when `ANTHROPIC_API_KEY` is set (or `AI_MODE=claude`). If Claude can't produce a usable verdict for an obligation, that obligation falls back to the offline engine. If no passage matches at all, the obligation is rated missing.

Each obligation shows when it was assessed and by which engine. After adding a key, select **Re-assess all** on the Obligations page to refresh existing results.
