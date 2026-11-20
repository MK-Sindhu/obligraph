"""Readiness packs and the NBFC scale-based-regulation (SBR) layer view."""

from __future__ import annotations

from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from obligraph import vocab
from obligraph.compliance.dashboard import coverage_pct
from obligraph.compliance.obligations import SEVERITY_RANK, applies, org_layer
from obligraph.models import Obligation, Org, Regulation, Requirement


@dataclass(frozen=True)
class Pack:
    key: str
    name: str
    description: str
    matches: Callable[[Regulation], bool]


PACKS = [
    Pack(
        "dpdp",
        "DPDP readiness",
        "Digital Personal Data Protection: notice, consent, safeguards, breach reporting, "
        "erasure and grievances. Binds every organisation that processes personal data.",
        lambda r: r.regulator == "MeitY" or "data_privacy" in r.topics,
    ),
    Pack(
        "cert_in",
        "CERT-In and cyber resilience",
        "Incident reporting timelines, log retention, clock synchronisation and cyber "
        "audits from CERT-In and sector regulators.",
        lambda r: r.regulator == "CERT-In" or "cyber_security" in r.topics,
    ),
    Pack(
        "kyc_aml",
        "KYC and AML",
        "Customer due diligence, periodic updation, record keeping and suspicious "
        "transaction reporting.",
        lambda r: bool({"kyc", "aml"} & set(r.topics)),
    ),
]
PACKS_BY_KEY = {p.key: p for p in PACKS}


async def _org_obligations(session: AsyncSession, org: Org):
    return (
        await session.execute(
            select(Obligation, Requirement, Regulation)
            .join(Requirement, Requirement.id == Obligation.requirement_id)
            .join(Regulation, Regulation.id == Requirement.regulation_id)
            .where(Obligation.org_id == org.id, Obligation.status != "not_applicable")
        )
    ).all()


def _summarise(pack: Pack, rows) -> dict:
    mine = [(o, q, r) for o, q, r in rows if pack.matches(r)]
    counts = Counter(o.coverage for o, _q, _r in mine)
    gaps = sorted(
        (x for x in mine if x[0].coverage in ("missing", "partial")),
        key=lambda x: (-SEVERITY_RANK.get(x[1].severity, 1), x[0].coverage != "missing"),
    )
    return {
        "key": pack.key,
        "name": pack.name,
        "description": pack.description,
        "obligations": len(mine),
        "by_coverage": dict(counts),
        "readiness_pct": coverage_pct(dict(counts)),
        "regulations": sorted({r.title for _o, _q, r in mine}),
        "top_gaps": [
            {
                "obligation_id": str(o.id),
                "requirement": q.text,
                "severity": q.severity,
                "coverage": o.coverage,
                "regulation": r.title,
                "ref_no": r.ref_no,
            }
            for o, q, r in gaps[:5]
        ],
    }


async def summaries(session: AsyncSession, org: Org) -> list[dict]:
    rows = await _org_obligations(session, org)
    return [_summarise(p, rows) for p in PACKS]


async def detail(session: AsyncSession, org: Org, key: str) -> dict:
    pack = PACKS_BY_KEY[key]
    rows = await _org_obligations(session, org)
    out = _summarise(pack, rows)
    out["items"] = [
        {
            "obligation_id": str(o.id),
            "requirement": q.text,
            "severity": q.severity,
            "kind": q.kind,
            "coverage": o.coverage,
            "status": o.status,
            "regulation": r.title,
            "regulation_id": str(r.id),
            "ref_no": r.ref_no,
            "regulator": r.regulator,
        }
        for o, q, r in sorted(rows, key=lambda x: -SEVERITY_RANK.get(x[1].severity, 1))
        if pack.matches(r)
    ]
    return out


async def sbr_view(session: AsyncSession, org: Org, target: str | None) -> dict:
    """Requirements by SBR layer for this NBFC, and what moving to ``target`` would add."""
    is_nbfc = bool(set(org.entity_classes) & vocab.NBFC_CLASSES)
    current = org_layer(org)
    if target is None and current:
        idx = vocab.SBR_LAYERS.index(current)
        target = vocab.SBR_LAYERS[min(idx + 1, len(vocab.SBR_LAYERS) - 1)]
    target = target or "middle"
    regs = (
        (
            await session.execute(
                select(Regulation)
                .where(Regulation.status == "in_force")
                .options(selectinload(Regulation.requirements))
            )
        )
        .scalars()
        .all()
    )

    per_layer = {layer: 0 for layer in vocab.SBR_LAYERS}
    layer_specific: list[dict] = []
    added: list[dict] = []
    relieved: list[dict] = []
    for reg in regs:
        for req in reg.requirements:
            hits = [layer for layer in vocab.SBR_LAYERS if applies(req, reg, org, layer=layer)]
            for layer in hits:
                per_layer[layer] += 1
            if not hits or len(hits) == len(vocab.SBR_LAYERS):
                continue  # not for this org at all, or the same at every layer
            item = {
                "requirement_id": str(req.id),
                "requirement": req.text,
                "severity": req.severity,
                "layers": hits,
                "regulation": reg.title,
                "regulation_id": str(reg.id),
                "ref_no": reg.ref_no,
            }
            layer_specific.append(item)
            at_current = current in hits if current else True
            if target in hits and not at_current:
                added.append(item)
            if current and current in hits and target not in hits:
                relieved.append(item)
    return {
        "applicable": is_nbfc,
        "current_layer": current,
        "target_layer": target,
        "layers": [
            {"key": k, "label": vocab.SBR_LABELS[k], "requirements": per_layer[k]}
            for k in vocab.SBR_LAYERS
        ],
        "layer_specific": layer_specific,
        "added_at_target": added,
        "relieved_at_target": relieved,
    }
