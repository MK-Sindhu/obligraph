"""Gap assessment: does the org's policy set meet a requirement?

Retrieval narrows the org's policy passages to the most relevant few; the engine
(Claude or offline) returns a verdict with quotes; quotes are then verified verbatim
against the passages. A "covered" verdict whose evidence cannot be verified is
downgraded, so an unsupported claim never reaches the register.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from xml.sax.saxutils import escape, quoteattr

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from obligraph import clock, search
from obligraph.ai import claude, offline
from obligraph.ai.prompts import ASSESSMENT_SYSTEM
from obligraph.ai.schemas import CoverageVerdict
from obligraph.audit import record
from obligraph.compliance.obligations import org_has_policies
from obligraph.jobs import enqueue, handler
from obligraph.models import Alert, Obligation, Regulation, Task
from obligraph.settings import get_settings
from obligraph.textutil import quote_in

PASSAGES = 6
PRIORITY_FROM_TASK = {"urgent": "urgent", "high": "high", "medium": "medium", "low": "low"}


def verify(verdict: CoverageVerdict, hits: list[search.Hit]) -> tuple[CoverageVerdict, list[dict]]:
    evidence = []
    for q in verdict.quotes:
        idx = q.passage - 1
        if 0 <= idx < len(hits) and quote_in(q.quote, hits[idx].text):
            h = hits[idx]
            evidence.append(
                {
                    "chunk_id": str(h.chunk_id),
                    "document_id": str(h.document_id),
                    "document_title": h.document_title,
                    "quote": q.quote.strip(),
                }
            )
    if verdict.coverage != "missing" and not evidence:
        note = " Cited policy text could not be verified verbatim, so confidence was reduced."
        verdict = verdict.model_copy(
            update={
                "coverage": "partial",
                "confidence": min(verdict.confidence, 0.35),
                "rationale": verdict.rationale + note,
            }
        )
    return verdict, evidence


def render_request(req, reg: Regulation, hits: list[search.Hit]) -> str:
    passages = "\n".join(
        f'<passage number="{i}" document={quoteattr(h.document_title)}>\n'
        f"{escape(h.text)}\n</passage>"
        for i, h in enumerate(hits, start=1)
    )
    return (
        f"<requirement regulator={quoteattr(reg.regulator)} "
        f'instrument={quoteattr(reg.ref_no or reg.title)} severity="{req.severity}">\n'
        f"{escape(req.text)}\n"
        f"<source_quote>{escape(req.source_quote)}</source_quote>\n"
        f"<evidence_expected>{escape(req.evidence_hint)}</evidence_expected>\n"
        f"</requirement>\n\n<policy_passages>\n{passages}\n</policy_passages>\n\n"
        "Assess coverage of this requirement by these policy passages."
    )


async def assess_obligation(session: AsyncSession, obligation_id: uuid.UUID) -> Obligation | None:
    ob = await session.get(Obligation, obligation_id)
    if ob is None or ob.status == "not_applicable":
        return ob
    req = ob.requirement
    reg = await session.get(Regulation, req.regulation_id)
    assert reg is not None
    if not await org_has_policies(session, ob.org_id):
        return ob

    query = f"{req.text} {req.evidence_hint}"
    hits = await search.search(session, query, scope="policies", org_id=ob.org_id, limit=PASSAGES)

    engine = "offline"
    if not hits:
        verdict = offline.assess_coverage(req.text, req.severity, [])
    elif get_settings().claude_enabled:
        try:
            verdict = await claude.structured(
                session,
                purpose="assess_obligation",
                system=ASSESSMENT_SYSTEM,
                content=render_request(req, reg, hits),
                schema=CoverageVerdict,
                effort=get_settings().effort_assessment,
                org_id=ob.org_id,
                max_tokens=16000,
            )
            engine = "claude"
        except claude.ClaudeError:
            verdict = offline.assess_coverage(
                req.text, req.severity, [(h.document_title, h.text) for h in hits]
            )
    else:
        verdict = offline.assess_coverage(
            req.text, req.severity, [(h.document_title, h.text) for h in hits]
        )

    verdict, evidence = verify(verdict, hits)
    previous = ob.coverage
    ob.coverage = verdict.coverage
    ob.confidence = round(max(0.0, min(1.0, verdict.confidence)), 2)
    ob.rationale = verdict.rationale
    ob.remediation = verdict.remediation
    ob.evidence = evidence
    ob.assessed_by = engine
    ob.assessed_at = datetime.now(UTC)

    # Replace this obligation's untouched AI-suggested tasks with the new suggestions.
    await session.execute(
        delete(Task).where(Task.obligation_id == ob.id, Task.source == "ai", Task.status == "todo")
    )
    today = clock.today()
    for t in verdict.tasks[:3]:
        session.add(
            Task(
                org_id=ob.org_id,
                obligation_id=ob.id,
                title=t.title[:300],
                detail=t.detail,
                priority=PRIORITY_FROM_TASK.get(t.priority, "medium"),
                source="ai",
                due_on=today + timedelta(days=max(1, min(t.due_in_days, 365))),
            )
        )

    if (
        verdict.coverage != "covered"
        and req.severity in ("high", "critical")
        and previous in ("unassessed", "covered")
    ):
        session.add(
            Alert(
                org_id=ob.org_id,
                kind="gap_found",
                severity=req.severity,
                title=f"{verdict.coverage.title()} coverage: {req.text[:120]}",
                body=verdict.rationale[:500],
                ref_type="obligation",
                ref_id=ob.id,
            )
        )
    await record(
        session,
        org_id=ob.org_id,
        actor_id=None,
        action="obligation.assessed",
        target_type="obligation",
        target_id=ob.id,
        data={"coverage": verdict.coverage, "engine": engine, "previous": previous},
    )
    await session.flush()
    return ob


@handler("assess_obligation")
async def assess_obligation_job(session: AsyncSession, payload: dict) -> None:
    await assess_obligation(session, uuid.UUID(payload["obligation_id"]))


@handler("assess_org")
async def assess_org_job(session: AsyncSession, payload: dict) -> None:
    org_id = uuid.UUID(payload["org_id"])
    ids = (
        (
            await session.execute(
                select(Obligation.id).where(
                    Obligation.org_id == org_id, Obligation.status != "not_applicable"
                )
            )
        )
        .scalars()
        .all()
    )
    for oid in ids:
        await enqueue(
            session, "assess_obligation", {"obligation_id": str(oid)}, dedupe_key=f"assess:{oid}"
        )
