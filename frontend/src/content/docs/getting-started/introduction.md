---
title: Introduction
description: What Obligraph does, how a circular becomes dated compliance work, and which Indian financial entity types it is built for.
order: 1
---

Obligraph tracks regulatory obligations for Indian financial institutions. It reads circulars and directions, breaks each one into checkable requirements, works out which of them bind your organisation, checks your policies against them, and turns the gaps into tasks, evidence and filings you can track.

## How it fits together

1. **Corpus.** Regulatory documents come from regulator RSS feeds, which are polled on a schedule, or are added by a platform admin as an upload or pasted text. The corpus is shared by every organisation on the same Obligraph instance.
2. **Requirements.** Each document is turned into instrument metadata and a list of requirements. Each requirement has a kind, severity, frequency, any hard deadline and the evidence an inspector would expect. Links to other instruments (amends, supersedes, references) go into a [knowledge graph](/docs/concepts/knowledge-graph-and-lineage).
3. **Obligations.** A requirement becomes an obligation for your organisation when it applies to your entity types and, for NBFCs, your [scale-based regulation layer](/docs/concepts/sbr-layers).
4. **Coverage.** Obligraph retrieves the most relevant passages from your uploaded policies and rates each obligation covered, partial or missing. Quotes from your policies are checked against the policy text before they're saved.
5. **Work.** Gaps produce suggested tasks. You track them on a task board, attach evidence, send high-impact work through maker-checker approval, and follow deadlines and statutory filings on a compliance calendar.

A Copilot answers questions over the corpus and your own data, and lists the sources it used.

## Who it's for

Each organisation picks one or more entity types. Obligraph recognises these:

| Primary regulator | Entity types |
|---|---|
| RBI | Commercial bank, Small finance bank, Payments bank, Co-operative bank, NBFC, NBFC-MFI, Housing finance company, Payment aggregator, PPI issuer, Asset reconstruction company |
| SEBI | Alternative investment fund, Mutual fund / AMC, Stock broker, Investment adviser, Portfolio manager, Depository participant, Listed entity |
| IRDAI | Insurer, Insurance intermediary |

Instruments from MeitY and CERT-In apply to every organisation unless they name specific entity types.

## AI and offline mode

Extraction, gap analysis and the Copilot use Claude when `ANTHROPIC_API_KEY` is configured. In that case the documents being processed, the relevant policy passages and your Copilot questions are sent to Anthropic's API.

Without a key, everything runs on a built-in offline engine that uses rules and keyword overlap, and no model provider is called. The offline engine is deliberately conservative. See [Security and data](/docs/security/security-and-data) for exactly what is sent where.

## Next steps

- [First steps](/docs/getting-started/first-steps)
- [Obligations and coverage](/docs/concepts/obligations-and-coverage)
