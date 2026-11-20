"""Shared regulatory corpus: regulations, knowledge graph, search, ingestion."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from obligraph import graph, search, vocab
from obligraph.api.deps import Caller, SessionDep, caller, superuser
from obligraph.api.schemas import (
    InForceRow,
    IngestResult,
    IngestText,
    Lineage,
    OrgImpactRow,
    Page,
    RegulationDetail,
    RegulationSummary,
    RequirementOut,
    SearchHitOut,
    Subgraph,
)
from obligraph.compliance.obligations import org_regulators
from obligraph.ingest.documents import UnsupportedDocument, bytes_to_text
from obligraph.ingest.pipeline import ingest_regulation
from obligraph.models import GraphNode, Obligation, Regulation, Requirement, User

router = APIRouter(tags=["corpus"])


def summarize(
    reg: Regulation, count: int, org_classes: set[str], regulators: list[str]
) -> RegulationSummary:
    out = RegulationSummary.model_validate(reg)
    out.requirement_count = count
    out.applies_to_org = (
        bool(set(reg.entity_classes) & org_classes)
        if reg.entity_classes
        else reg.regulator in regulators
    )
    return out


@router.get("/regulations", response_model=Page[RegulationSummary])
async def list_regulations(
    c: Caller = Depends(caller),
    q: str | None = None,
    regulator: str | None = None,
    topic: str | None = None,
    status_: str | None = Query(None, alias="status"),
    applies: bool = Query(False, description="Only instruments that apply to my organisation."),
    limit: int = Query(25, le=100),
    offset: int = 0,
) -> Page[RegulationSummary]:
    stmt = select(Regulation)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                Regulation.title.ilike(like),
                Regulation.ref_no.ilike(like),
                Regulation.summary.ilike(like),
            )
        )
    if regulator:
        stmt = stmt.where(Regulation.regulator == regulator)
    if topic:
        stmt = stmt.where(Regulation.topics.any(topic))
    if status_:
        stmt = stmt.where(Regulation.status == status_)
    if applies:
        stmt = stmt.where(
            Regulation.id.in_(
                select(Requirement.regulation_id)
                .join(Obligation, Obligation.requirement_id == Requirement.id)
                .where(Obligation.org_id == c.org.id)
            )
        )
    total = (
        await c.session.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    regs = (
        (
            await c.session.execute(
                stmt.order_by(
                    Regulation.issued_on.desc().nulls_last(), Regulation.created_at.desc()
                )
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    counts = dict(
        (
            await c.session.execute(
                select(Requirement.regulation_id, func.count())
                .where(Requirement.regulation_id.in_([r.id for r in regs]))
                .group_by(Requirement.regulation_id)
            )
        ).all()
    )
    classes, regulators = set(c.org.entity_classes), org_regulators(c.org)
    return Page(
        items=[summarize(r, counts.get(r.id, 0), classes, regulators) for r in regs],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/regulations/{regulation_id}", response_model=RegulationDetail)
async def regulation_detail(
    regulation_id: uuid.UUID, c: Caller = Depends(caller)
) -> RegulationDetail:
    reg = (
        await c.session.execute(
            select(Regulation)
            .where(Regulation.id == regulation_id)
            .options(selectinload(Regulation.requirements))
        )
    ).scalar_one_or_none()
    if reg is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "regulation not found")
    impact = (
        (
            await c.session.execute(
                select(Obligation).where(
                    Obligation.org_id == c.org.id,
                    Obligation.requirement_id.in_([r.id for r in reg.requirements]),
                )
            )
        )
        .scalars()
        .all()
    )
    base = summarize(reg, len(reg.requirements), set(c.org.entity_classes), org_regulators(c.org))
    return RegulationDetail(
        **base.model_dump(),
        requirements=[RequirementOut.model_validate(r) for r in reg.requirements],
        lineage=Lineage.model_validate(await graph.lineage(c.session, reg.node_id)),
        org_impact=[
            OrgImpactRow(
                obligation_id=o.id,
                requirement_id=o.requirement_id,
                coverage=o.coverage,
                status=o.status,
            )
            for o in impact
        ],
    )


@router.post("/regulations/ingest", response_model=IngestResult, status_code=202)
async def ingest_text(
    body: IngestText, _: User = Depends(superuser), session=SessionDep
) -> IngestResult:
    regulator = vocab.canonical_regulator(body.regulator)
    if regulator is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "unknown regulator")
    doc = await ingest_regulation(
        session,
        title=body.title,
        text=body.text,
        regulator=regulator,
        url=body.url,
        published_on=body.published_on,
    )
    return IngestResult(document_id=doc.id, created=doc.status == "pending", status=doc.status)


@router.post("/regulations/upload", response_model=IngestResult, status_code=202)
async def ingest_file(
    file: UploadFile = File(...),
    regulator: str = Form(...),
    title: str | None = Form(None),
    _: User = Depends(superuser),
    session=SessionDep,
) -> IngestResult:
    reg = vocab.canonical_regulator(regulator)
    if reg is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "unknown regulator")
    data = await file.read()
    try:
        text = bytes_to_text(file.filename or "upload", data, file.content_type)
    except UnsupportedDocument as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    doc = await ingest_regulation(
        session, title=title or (file.filename or "Uploaded document"), text=text, regulator=reg
    )
    return IngestResult(document_id=doc.id, created=doc.status == "pending", status=doc.status)


# --------------------------------------------------------------------------- graph


@router.get("/graph", response_model=Subgraph, tags=["graph"])
async def graph_overview(
    c: Caller = Depends(caller),
    topic: str | None = None,
    mine: bool = Query(False, description="Only instruments applying to my entity types."),
    limit: int = Query(150, le=500),
) -> Subgraph:
    data = await graph.overview(
        c.session, topic=topic, limit=limit, entity_classes=c.org.entity_classes if mine else None
    )
    return Subgraph.model_validate(data)


@router.get("/graph/nodes/{node_id}", response_model=Subgraph, tags=["graph"])
async def graph_neighbors(node_id: uuid.UUID, c: Caller = Depends(caller)) -> Subgraph:
    if await c.session.get(GraphNode, node_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "node not found")
    return Subgraph.model_validate(await graph.neighborhood(c.session, node_id))


@router.get("/graph/in-force", response_model=list[InForceRow], tags=["graph"])
async def in_force(
    on: date, topic: str | None = None, c: Caller = Depends(caller)
) -> list[InForceRow]:
    return [InForceRow(**r) for r in await graph.in_force_on(c.session, on, topic)]


@router.get("/graph/stats", tags=["graph"])
async def graph_stats(c: Caller = Depends(caller)) -> dict:
    return await graph.stats(c.session)


# --------------------------------------------------------------------------- search


@router.get("/search", response_model=list[SearchHitOut], tags=["search"])
async def search_passages(
    q: str = Query(min_length=2),
    scope: search.Scope = "regulations",
    regulator: str | None = None,
    limit: int = Query(10, le=30),
    c: Caller = Depends(caller),
) -> list[SearchHitOut]:
    hits = await search.search(
        c.session, q, scope=scope, org_id=c.org.id, limit=limit, regulator=regulator
    )
    return [SearchHitOut(**h.__dict__) for h in hits]
