"""Applicability: which requirements bind which org, and keeping obligations in sync."""

from __future__ import annotations

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from obligraph import vocab
from obligraph.jobs import enqueue
from obligraph.models import (
    Alert,
    Document,
    GraphEdge,
    Obligation,
    Org,
    Regulation,
    Requirement,
)

SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}


def org_regulators(org: Org) -> list[str]:
    return list(dict.fromkeys([*(org.regulators or []), *vocab.regulators_for(org.entity_classes)]))


def org_layer(org: Org) -> str | None:
    layer = (org.profile or {}).get("sbr_layer")
    return layer if layer in vocab.SBR_LAYERS else None


def applies(req: Requirement, reg: Regulation, org: Org, *, layer: str | None = "profile") -> bool:
    """Does ``req`` bind ``org``? ``layer`` overrides the org's SBR layer (for what-if views);
    an NBFC whose layer is unknown is treated as bound by every layer, the safe default."""
    classes = req.entity_classes or reg.entity_classes
    if classes:
        if not set(classes) & set(org.entity_classes):
            return False
    elif reg.regulator not in vocab.UNIVERSAL_REGULATORS and reg.regulator not in org_regulators(
        org
    ):
        return False
    layers = req.layers or reg.layers
    if layers and set(org.entity_classes) & vocab.NBFC_CLASSES:
        effective = org_layer(org) if layer == "profile" else layer
        if effective and effective not in layers:
            return False
    return True


def why_not(req: Requirement, reg: Regulation, org: Org) -> str:
    layers = req.layers or reg.layers
    if layers and org_layer(org) and org_layer(org) not in layers:
        names = ", ".join(vocab.SBR_LABELS[x] for x in layers)
        return f"Applies only to {names}; your organisation is {vocab.SBR_LABELS[org_layer(org)]}."
    return "Does not apply to your organisation's entity types."


async def org_has_policies(session: AsyncSession, org_id: uuid.UUID) -> bool:
    return (
        await session.execute(
            select(Document.id).where(Document.org_id == org_id, Document.kind == "policy").limit(1)
        )
    ).first() is not None


async def sync_org(
    session: AsyncSession, org: Org, regulations: list[Regulation] | None = None
) -> list[Obligation]:
    """Create obligations for applicable, in-force requirements the org does not have yet."""
    if regulations is None:
        regulations = list(
            (
                await session.execute(
                    select(Regulation)
                    .where(Regulation.status == "in_force")
                    .options(selectinload(Regulation.requirements))
                )
            ).scalars()
        )
    else:
        for reg in regulations:
            await session.refresh(reg, ["requirements"])
    existing = set(
        (
            await session.execute(
                select(Obligation.requirement_id).where(Obligation.org_id == org.id)
            )
        ).scalars()
    )
    created: list[Obligation] = []
    for reg in regulations:
        if reg.status != "in_force":
            continue
        for req in reg.requirements:
            if req.id in existing or not applies(req, reg, org):
                continue
            ob = Obligation(id=uuid.uuid4(), org_id=org.id, requirement_id=req.id)
            ob.requirement = req
            session.add(ob)
            created.append(ob)
    await session.flush()
    return created


async def resync_org(session: AsyncSession, org: Org) -> dict[str, list[Obligation]]:
    """After a profile change: add newly applicable obligations, reopen ones retired for
    profile reasons that apply again, and retire ones that no longer apply."""
    created = await sync_org(session, org)
    rows = (
        await session.execute(
            select(Obligation, Requirement, Regulation)
            .join(Requirement, Requirement.id == Obligation.requirement_id)
            .join(Regulation, Regulation.id == Requirement.regulation_id)
            .where(Obligation.org_id == org.id, Regulation.status == "in_force")
        )
    ).all()
    reopened: list[Obligation] = []
    retired: list[Obligation] = []
    for ob, req, reg in rows:
        ok = applies(req, reg, org)
        if ok and ob.status == "not_applicable" and ob.retired_reason == "profile":
            ob.status, ob.retired_reason = "open", None
            reopened.append(ob)
        elif not ok and ob.status != "not_applicable":
            ob.status, ob.retired_reason, ob.rationale = (
                "not_applicable",
                "profile",
                why_not(req, reg, org),
            )
            retired.append(ob)
    await session.flush()
    return {"created": created, "reopened": reopened, "retired": retired}


async def queue_assessments(session: AsyncSession, obligations: list[Obligation]) -> None:
    for ob in obligations:
        await enqueue(
            session,
            "assess_obligation",
            {"obligation_id": str(ob.id)},
            dedupe_key=f"assess:{ob.id}",
        )


async def on_new_regulation(session: AsyncSession, reg: Regulation) -> None:
    orgs = (await session.execute(select(Org))).scalars().all()
    for org in orgs:
        new = await sync_org(session, org, [reg])
        if not new:
            continue
        top = max((ob.requirement.severity for ob in new), key=lambda s: SEVERITY_RANK.get(s, 1))
        session.add(
            Alert(
                org_id=org.id,
                kind="new_regulation",
                severity=top,
                title=f"{reg.regulator}: {reg.title}",
                body=f"{len(new)} new obligation{'s' if len(new) != 1 else ''} apply to "
                f"{org.name}.",
                ref_type="regulation",
                ref_id=reg.id,
            )
        )
        if await org_has_policies(session, org.id):
            await queue_assessments(session, new)
    await retire_superseded(session, reg)


async def retire_superseded(session: AsyncSession, reg: Regulation) -> None:
    """Obligations from instruments this regulation supersedes no longer apply."""
    targets = (
        (
            await session.execute(
                select(Regulation)
                .join(GraphEdge, GraphEdge.dst_id == Regulation.node_id)
                .where(GraphEdge.src_id == reg.node_id, GraphEdge.rel == "SUPERSEDES")
            )
        )
        .scalars()
        .all()
    )
    for old in targets:
        old.status = "superseded"
        req_ids = select(Requirement.id).where(Requirement.regulation_id == old.id)
        affected = (
            (
                await session.execute(
                    select(Obligation.org_id)
                    .where(
                        Obligation.requirement_id.in_(req_ids),
                        Obligation.status != "not_applicable",
                    )
                    .distinct()
                )
            )
            .scalars()
            .all()
        )
        await session.execute(
            update(Obligation)
            .where(Obligation.requirement_id.in_(req_ids), Obligation.status != "not_applicable")
            .values(
                status="not_applicable",
                retired_reason="superseded",
                rationale=f"Superseded by {reg.ref_no or reg.title}.",
            )
        )
        for org_id in affected:
            session.add(
                Alert(
                    org_id=org_id,
                    kind="superseded",
                    severity="medium",
                    title=f"Superseded: {old.title}",
                    body=f"Replaced by {reg.title}. Its obligations were retired; review the "
                    "new instrument's obligations.",
                    ref_type="regulation",
                    ref_id=reg.id,
                )
            )
    await session.flush()
