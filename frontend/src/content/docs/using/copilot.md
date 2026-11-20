---
title: Copilot
description: What the Copilot can look up, how offline retrieval summaries differ from written answers with Claude, citations, and how conversations are kept.
order: 7
---

The **Copilot** answers questions about regulations and about your organisation's obligations, gaps, tasks and policies. Everyone in the organisation can use it, including viewers.

## What it can look up

| Tool | Shown as | What it returns |
|---|---|---|
| `search_regulations` | Searching regulations | Matching passages from the regulatory corpus |
| `get_regulation` | Reading the regulation | One instrument's metadata, status, summary and requirements |
| `trace_lineage` | Tracing lineage | What an instrument amends or supersedes, and what amends or supersedes it |
| `regulations_in_force_on` | Checking what was in force | Instruments issued and not yet superseded on a given date |
| `list_obligations` | Reviewing your obligations | Your obligations and their coverage |
| `list_tasks` | Reviewing tasks | Your remediation and compliance tasks |
| `upcoming_deadlines` | Checking upcoming deadlines | Deadlines, recurring items, filings and task due dates coming up |
| `search_policies` | Searching your policies | Passages from your uploaded policies |
| `get_org_profile` | Reading your organisation profile | Your entity types, regulators and coverage figures |

The tools only read data. The Copilot can't change anything in Obligraph.

## With Claude

When Claude is configured, the Copilot works as an agent: it decides which tools to call, reads the results and writes an answer, which streams in as it's written. It's instructed to base every claim on tool results, to say when something isn't in Obligraph's corpus rather than answering from memory, and to check lineage before calling an instrument current.

Your question, the conversation so far and the tool results are sent to Anthropic's API.

## Offline

Without Claude, the Copilot shows an **Offline mode** notice. Instead of a written analysis, it gives a retrieval summary:

- the most relevant regulations, with a short extract and a note if they're superseded;
- a table of your related obligations, with severity and coverage;
- matching passages from your policies.

Nothing is sent to Anthropic in offline mode.

## Citations

Under each answer, **Sources** lists the regulations and policies the Copilot consulted. A regulation links to its page under **Regulations**, with a status badge if it isn't in force. A policy links to **Policies**.

## Conversations

Conversations belong to you and the organisation you're in. Other members can't see them, and switching organisation shows that organisation's conversations. Follow-up questions keep the context of the conversation so far. You can delete a conversation from the list.
