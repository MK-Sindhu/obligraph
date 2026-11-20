---
title: Obligations and coverage
description: How requirements become obligations, how coverage is assessed and scored, how policy quotes are verified, and what each status means.
order: 1
---

## Requirements and obligations

A **requirement** is one discrete, checkable thing an instrument asks of regulated entities. It belongs to the shared corpus and has a kind (obligation, prohibition, reporting, disclosure or governance), a severity (low, medium, high, critical), a frequency, any hard deadline, the evidence an inspector would expect, and the source sentence it came from.

An **obligation** is a requirement as it applies to your organisation. It holds your coverage assessment, status, owner, tasks and evidence.

## Applicability

A requirement applies to you when all of these hold:

- **Entity types**: the requirement's entity types (or its instrument's, if the requirement lists none) include at least one of yours. If neither lists any, the regulator must be one of yours, or MeitY or CERT-In, whose instruments bind everyone.
- **SBR layer**: for NBFCs, it isn't limited to layers other than yours. An unset layer counts as every layer.
- **Status**: its instrument is in force.

Obligations are created when you register, when a matching instrument is ingested, and when you change your entity types or layer.

## Coverage

| Coverage | Meaning |
|---|---|
| Covered | Your policies commit to everything the requirement asks |
| Partial | Your policies address the subject but miss or weaken something |
| Missing | Nothing in your policies addresses it |
| Unassessed | Not assessed yet, for example because no policy is uploaded |

Coverage % (on the dashboard, readiness packs and board pack) is weighted:

```
coverage % = (covered + 0.5 × partial) / (covered + partial + missing) × 100
```

Unassessed and retired obligations are left out. If nothing is assessed, no percentage is shown.

**Confidence** runs from 0 to 1 and shows how sure the assessment is. Hover over a coverage badge to see it.

## Verified quotes

A covered or partial verdict must quote the policy passages it relies on. Before saving, Obligraph checks each quote against the numbered passage it cites. Both are lower-cased and reduced to letters and digits, so punctuation and spacing don't matter. The quote must be at least 12 characters and appear inside that passage. Quotes that fail are thrown away.

If no quote survives, the verdict becomes **Partial**, confidence is capped at 0.35, and the rationale says the cited text couldn't be verified. Verified quotes appear under **Evidence from your policies**.

## When obligations are re-assessed

- When a policy is uploaded or deleted (every obligation).
- When someone selects **Re-assess** on an obligation (members and above) or **Re-assess all** on the Obligations page (admins and owners).
- When new obligations arrive from a new instrument or a profile change, if you have policies.

Re-assessment replaces suggested tasks still in **To do** that nobody has edited.

## Statuses

Set status in the obligation's **Tracking** section: **Open**, **In progress**, **Met** or **Not applicable**.

## Retired obligations

Obligraph retires an obligation (status **Not applicable**) when its instrument is superseded, or when a change to your entity types or layer means it no longer applies. If a profile change makes it apply again, it reopens. Retired obligations are hidden from the register unless you set **Status** to Not applicable.
