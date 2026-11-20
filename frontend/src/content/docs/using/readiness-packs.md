---
title: Readiness packs
description: The DPDP, CERT-In and KYC/AML readiness packs, how each readiness percentage is calculated, and how top gaps are chosen.
order: 5
---

Readiness packs group your obligations by regime, so you can see how ready you are for each one. Open **Readiness** and choose **Readiness packs**.

## The packs

| Key | Name | Obligations included |
|---|---|---|
| `dpdp` | DPDP readiness | From instruments issued by MeitY, or tagged with the data privacy topic |
| `cert_in` | CERT-In and cyber resilience | From instruments issued by CERT-In, or tagged with the cyber security topic |
| `kyc_aml` | KYC and AML | From instruments tagged with the KYC or AML / CFT topic |

Matching works at the instrument level: every active obligation from a matching instrument belongs to the pack. An obligation can be in more than one pack. Retired obligations are left out.

Instruments from MeitY and CERT-In apply to every organisation unless they name specific entity types, so their obligations can appear in these packs whatever your entity types are.

## Readiness percentage

Readiness uses the same weighting as overall [coverage](/docs/concepts/obligations-and-coverage):

```
readiness % = (covered + 0.5 × partial) / (covered + partial + missing) × 100
```

Unassessed obligations don't count. If nothing in a pack has been assessed yet, it shows no percentage.

## Top gaps

Each pack card lists up to five top gaps. These are obligations rated missing or partial, ordered by severity (critical first) and, within the same severity, missing before partial.

Open a pack to see every item in it, with its severity, coverage and instrument, and filter the list by coverage.

## Where packs appear

Each pack's name, number of obligations and readiness percentage also appear in the [board pack](/docs/using/board-pack).

## Sample content

The DPDP and CERT-In documents in the demo corpus are illustrative samples, not official publications. A pack only reflects the instruments that have actually been ingested into your Obligraph corpus, so check that the current versions of the instruments you rely on are there.
