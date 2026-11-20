"""Document -> regulation -> requirements -> graph -> obligations.

``store_document`` is synchronous with the request (chunk + index); everything that
calls a model runs in the ``process_regulation`` job.
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from obligraph import embeddings, graph, vocab
from obligraph.ai import offline
from obligraph.ai.claude import ClaudeError
from obligraph.ai.extract import extract
from obligraph.ai.schemas import ExtractedRegulation
from obligraph.compliance.obligations import on_new_regulation
from obligraph.jobs import enqueue, handler
from obligraph.models import Chunk, Document, GraphEdge, Regulation, Requirement
from obligraph.textutil import chunk_text, parse_date, sha256

log = logging.getLogger(__name__)


def ref_key(ref: str) -> str:
    return "ref:" + re.sub(r"[^a-z0-9]+", "", ref.lower())


async def store_document(
    session: AsyncSession,
    *,
    kind: str,
    title: str,
    text: str,
    org_id: uuid.UUID | None = None,
    regulator: str | None = None,
    source_key: str | None = None,
    url: str | None = None,
    filename: str | None = None,
    published_on: date | None = None,
    uploaded_by: uuid.UUID | None = None,
    meta: dict | None = None,
) -> tuple[Document, bool]:
    """Insert and index a document. Returns (document, created); duplicates are reused."""
    dedupe_key = f"{org_id or 'public'}:{kind}:{sha256(text)}"
    existing = (
        await session.execute(select(Document).where(Document.dedupe_key == dedupe_key))
    ).scalar_one_or_none()
    if existing:
        return existing, False

    doc = Document(
        id=uuid.uuid4(),
        org_id=org_id,
        kind=kind,
        title=title.strip()[:500],
        text=text,
        regulator=regulator,
        source_key=source_key,
        url=url,
        filename=filename,
        published_on=published_on,
        dedupe_key=dedupe_key,
        uploaded_by=uploaded_by,
        meta=meta or {},
        status="pending" if kind == "regulation" else "processed",
    )
    session.add(doc)
    await session.flush()  # the document row must exist before its chunks
    passages = chunk_text(text)
    vectors = await embeddings.embed(passages) or [None] * len(passages)
    for i, (passage, vec) in enumerate(zip(passages, vectors, strict=True)):
        session.add(
            Chunk(document_id=doc.id, org_id=org_id, ordinal=i, text=passage, embedding=vec)
        )
    await session.flush()
    return doc, True


async def ingest_regulation(
    session: AsyncSession,
    *,
    title: str,
    text: str,
    regulator: str,
    source_key: str | None = None,
    url: str | None = None,
    published_on: date | None = None,
    meta: dict | None = None,
) -> Document:
    doc, created = await store_document(
        session,
        kind="regulation",
        title=title,
        text=text,
        regulator=regulator,
        source_key=source_key,
        url=url,
        published_on=published_on,
        meta=meta,
    )
    if created:
        await enqueue(
            session,
            "process_regulation",
            {"document_id": str(doc.id)},
            dedupe_key=f"process:{doc.id}",
        )
    return doc


@handler("process_regulation")
async def process_regulation_job(session: AsyncSession, payload: dict) -> None:
    doc = await session.get(Document, uuid.UUID(payload["document_id"]))
    if doc is None:
        return
    done = (
        await session.execute(select(Regulation).where(Regulation.document_id == doc.id))
    ).scalar_one_or_none()
    if done:
        return
    published = doc.published_on.isoformat() if doc.published_on else None
    try:
        extracted, engine = await extract(
            session, title=doc.title, text=doc.text, published_on=published
        )
    except ClaudeError as exc:
        log.warning("claude extraction failed for %s (%s); using offline engine", doc.id, exc)
        extracted, engine = offline.extract_regulation(doc.title, doc.text, published), "offline"
    reg = await persist_regulation(session, doc, extracted, engine)
    doc.status = "processed"
    await session.flush()
    await on_new_regulation(session, reg)


def _infer_regulator(doc: Document, ex: ExtractedRegulation) -> str:
    reg = vocab.canonical_regulator(doc.regulator)
    if reg:
        return reg
    probe = f"{ex.ref_no or ''} {doc.title}".upper()
    for key in vocab.REGULATORS:
        if key.upper() in probe:
            return key
    return doc.regulator or "OTHER"


async def _find_regulation(session: AsyncSession, ref: str | None, title: str | None):
    if ref:
        key = re.sub(r"[^a-z0-9]+", "", ref.lower())
        hit = (
            (
                await session.execute(
                    select(Regulation).where(
                        func.regexp_replace(func.lower(Regulation.ref_no), "[^a-z0-9]+", "", "g")
                        == key
                    )
                )
            )
            .scalars()
            .first()
        )
        if hit:
            return hit
    if title:
        return (
            (
                await session.execute(
                    select(Regulation).where(func.lower(Regulation.title) == title.strip().lower())
                )
            )
            .scalars()
            .first()
        )
    return None


async def persist_regulation(
    session: AsyncSession, doc: Document, ex: ExtractedRegulation, engine: str
) -> Regulation:
    regulator = _infer_regulator(doc, ex)
    reg_classes = vocab.canonical_entity_classes(ex.entity_classes)
    reg_topics = vocab.canonical_topics(ex.topics)
    issued = parse_date(ex.issued_on) or doc.published_on
    effective = parse_date(ex.effective_on)
    title = ex.title or doc.title

    node_key = ref_key(ex.ref_no) if ex.ref_no else f"doc:{doc.id}"
    node_id = await graph.upsert_node(
        session,
        "regulation",
        node_key,
        title,
        {
            "ref_no": ex.ref_no,
            "regulator": regulator,
            "placeholder": False,
            "issued_on": issued.isoformat() if issued else None,
        },
    )
    reg = Regulation(
        id=uuid.uuid4(),
        document_id=doc.id,
        node_id=node_id,
        regulator=regulator,
        ref_no=ex.ref_no,
        title=title,
        doc_type=ex.doc_type,
        summary=ex.summary,
        issued_on=issued,
        effective_on=effective,
        entity_classes=reg_classes,
        topics=reg_topics,
        layers=vocab.canonical_layers(ex.sbr_layers),
        url=doc.url,
        extracted_by=engine,
    )
    session.add(reg)
    for i, r in enumerate(ex.requirements):
        classes = vocab.canonical_entity_classes(r.entity_classes)
        session.add(
            Requirement(
                regulation_id=reg.id,
                ordinal=i,
                text=r.text,
                source_quote=r.source_quote,
                kind=r.kind,
                severity=r.severity,
                frequency=r.frequency,
                due_on=parse_date(r.due_date),
                entity_classes=classes,
                topics=vocab.canonical_topics(r.topics) or reg_topics[:1],
                layers=vocab.canonical_layers(r.sbr_layers),
                evidence_hint=r.evidence_hint,
            )
        )
    await session.flush()

    # Structural edges.
    regulator_node = await graph.upsert_node(
        session, "regulator", regulator, vocab.REGULATORS.get(regulator, regulator)
    )
    await graph.link(session, node_id, regulator_node, "ISSUED_BY")
    for ec in reg_classes:
        label = vocab.ENTITY_CLASSES[ec][0]
        await graph.link(
            session,
            node_id,
            await graph.upsert_node(session, "entity_class", ec, label),
            "APPLIES_TO",
        )
    for topic in reg_topics:
        label = vocab.TOPICS.get(topic, (topic.replace("_", " ").title(),))[0]
        await graph.link(
            session, node_id, await graph.upsert_node(session, "topic", topic, label), "COVERS"
        )
    for act in ex.parent_acts:
        await graph.link(
            session,
            node_id,
            await graph.upsert_node(session, "act", vocab.slug(act), act),
            "DERIVED_FROM",
        )

    # Lineage edges. Unknown targets become placeholder nodes that are filled in when
    # the referenced instrument is ingested later (same ref key -> same node).
    since = effective or issued
    for lk in ex.links:
        target = await _find_regulation(session, lk.target_ref, lk.target_title)
        if target is not None and target.id == reg.id:
            continue
        if target is not None:
            target_node = target.node_id
        else:
            target_node = await graph.upsert_node(
                session,
                "regulation",
                ref_key(lk.target_ref),
                lk.target_title or lk.target_ref,
                {"ref_no": lk.target_ref, "placeholder": True},
            )
        rel = lk.relation.upper()
        await graph.link(session, node_id, target_node, rel, valid_from=since)
        if target is not None and lk.relation == "supersedes":
            target.status = "superseded"

    # Was this instrument already superseded by something ingested earlier?
    superseded_by = (
        await session.execute(
            select(GraphEdge.id).where(GraphEdge.dst_id == node_id, GraphEdge.rel == "SUPERSEDES")
        )
    ).first()
    if superseded_by:
        reg.status = "superseded"
    await session.flush()
    return reg
