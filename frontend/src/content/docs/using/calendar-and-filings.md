---
title: Calendar and filings
description: Calendar event kinds, the returns catalogue and custom returns, filing statuses, and who can mark a filing as filed, waive it or reopen it.
order: 3
---

## Compliance calendar

**Calendar** shows four kinds of event:

| Kind | Shown as | Where it comes from |
|---|---|---|
| `deadline` | Deadline | A requirement with a fixed due date that doesn't recur |
| `recurring` | Recurring filing | A monthly, quarterly, half-yearly or annual requirement, repeated from its due date, else its instrument's effective date, else the issue date |
| `task` | Task due | A task's due date |
| `filing` | Filing due | A statutory filing's due date |

An event is flagged overdue when its date has passed and the obligation isn't **Met**, the task isn't **Done**, or the filing hasn't been filed or waived. Retired obligations don't appear.

## Returns catalogue

**Filings → Returns catalogue** lists the returns that apply to you. Obligraph includes a built-in catalogue of **sample** entries: returns for NBFCs (some limited to particular SBR layers), banks, payment aggregators and AIFs, an FIU-IND cash transaction report and a CERT-In cyber security audit.

Sample entries carry a **Sample** badge. Their names, frequencies and due days are illustrative, so check each one against current directions before relying on it. Catalogue entries are read-only.

Admins and owners can **Add a custom return** with a code, name, regulator, frequency (monthly, quarterly, half-yearly or annual), **Due within (days)** of the period end (0 to 365), and optionally a filing portal and description. Custom returns apply only to your organisation. To stop scheduling one, edit it and turn off **Active (schedule new filings)**.

## Filings

Obligraph creates one filing per return per period. Periods follow the Indian financial year: half-years run April to September and October to March, and years run April to March. A filing is due the return's number of due days after its period ends. Obligraph schedules filings due within a rolling window of 120 days back and 120 days ahead.

| Status | Shown as | Meaning |
|---|---|---|
| `pending` | Pending | Not filed, not yet due |
| `overdue` | Overdue | Not filed, past its due date |
| `filed` | Filed | Filed on or before the due date |
| `late` | Filed late | Filed after the due date |
| `waived` | Waived | Not required for this period |

## Actions

| Action | Who | What it needs |
|---|---|---|
| **Mark as filed** | Members, admins and owners | The filed-on date (not in the future) and an acknowledgement or reference number. Optionally a note and the acknowledgement file, which is kept as evidence |
| **Waive** | Admins and owners | A reason |
| **Reopen** | Admins and owners | Nothing. Returns a filed or waived filing to pending and clears its filed date and reference |

Only pending or overdue filings can be filed or waived. Filing, waiving and reopening are recorded in the activity log, and missed or late filings appear in the [board pack](/docs/using/board-pack).
