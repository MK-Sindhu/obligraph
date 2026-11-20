---
title: Knowledge graph and lineage
description: The node kinds and relations in Obligraph's knowledge graph, placeholders for referenced instruments, and the in-force-on-a-date view.
order: 2
---

Obligraph links every ingested instrument into a knowledge graph. Explore it on the **Graph** page; each regulation's own page shows its lineage.

## Nodes

| Kind | What it represents |
|---|---|
| Regulation | An instrument, such as a circular, master direction or notification |
| Regulator | The issuing body, such as RBI or SEBI |
| Entity type | A kind of regulated entity, such as NBFC |
| Topic | A subject, such as KYC, cyber security or digital lending |
| Act | A statute an instrument is issued under |

## Relations

| Relation | From → to | Meaning |
|---|---|---|
| `ISSUED_BY` | regulation → regulator | Who issued it |
| `APPLIES_TO` | regulation → entity type | Which entity types it names |
| `COVERS` | regulation → topic | What it's about |
| `DERIVED_FROM` | regulation → act | The statute it's issued under |
| `AMENDS` | regulation → regulation | It changes an earlier instrument |
| `SUPERSEDES` | regulation → regulation | It replaces an earlier instrument |
| `REFERENCES` | regulation → regulation | It cites another instrument |

Links between instruments record a date: the newer instrument's effective date, or its issue date if no effective date is known.

When an instrument supersedes one already in the corpus, the older one is marked **Superseded** and the obligations it created are retired.

## Placeholders

Instruments often cite others that haven't been ingested. Obligraph still creates a regulation node for the target, keyed on its reference number, and marks it as a placeholder. In lineage it shows as "Referenced, not ingested yet".

When that instrument is ingested later with the same reference number, it takes over the placeholder node, so the existing links now point at it. If it arrives after something that already supersedes it, it's marked superseded on arrival and creates no obligations.

## Lineage

A regulation's **Lineage** section lists the instruments connected to it through amendments and supersessions, in both directions, oldest first. The Copilot walks the same links before it calls an instrument current.

## In force on a date

On the **Graph** page, the **In force on date** panel answers "what was in force on this date?". It lists instruments issued on or before that date (or with no known issue date) that hadn't been superseded by then. You can narrow it to one topic.

An instrument counts as superseded from the date on its `SUPERSEDES` link. Amendments don't remove an instrument from the list.

## Filtering the graph

Turn on **Only what applies to us** to show only instruments that name your entity types, and use **Topic** to focus on one subject.
