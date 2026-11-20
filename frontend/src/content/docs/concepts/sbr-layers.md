---
title: SBR layers
description: How Obligraph applies RBI's scale-based regulation for NBFCs, how your layer changes your obligations, and how to compare layers.
order: 3
---

RBI's scale-based regulation (SBR) sorts NBFCs into four layers, from the lightest regulation to the strictest:

| Layer | Short form Obligraph recognises |
|---|---|
| Base Layer | NBFC-BL |
| Middle Layer | NBFC-ML |
| Upper Layer | NBFC-UL |
| Top Layer | NBFC-TL |

## Which organisations it affects

Layers only matter if your entity types include **NBFC**, **NBFC-MFI** or **Housing finance company**. For any other organisation, layer limits on requirements are ignored, and the SBR view says scale-based regulation doesn't apply to you.

## How layers are read from documents

When a requirement, or a whole instrument, is limited to particular layers, extraction records them. "Middle Layer and above" means Middle, Upper and Top. The offline engine recognises layer names ("Upper Layer") and the short forms above ("NBFC-ML and above"). A requirement with no layer limit applies at every layer.

## How your layer changes obligations

Admins and owners set the layer in **Settings → Organisation → Workflow and controls → Scale-based regulation layer**. When it changes, Obligraph:

- adds obligations for requirements that apply at the new layer;
- retires obligations limited to layers you're no longer in, with a note naming the layers they apply to;
- reopens obligations it retired earlier for this reason, if they apply again;
- queues the added and reopened obligations for assessment, if you have policies.

A message confirms how many obligations were added and retired. If no layer is set, you're treated as bound by every layer-specific requirement.

Sample returns in the filings catalogue can also be limited to certain layers, so your layer affects which filings are scheduled.

## The SBR view

Open **Readiness** and choose **SBR layers**:

- **Scale-based regulation layers** shows how many in-force requirements would apply to you at each layer, with your current layer marked.
- **Compare with** picks a target layer. It starts on the layer above yours.
- **What moving to Upper adds** (named after the layer you pick) lists requirements that apply at the target but not at your current layer.
- **What it relieves** lists requirements that apply at your current layer but not at the target.
- **Layer-specific requirements** lists every requirement that differs between layers.

The comparison needs your current layer to be set. If it isn't, the view links you to Settings.
