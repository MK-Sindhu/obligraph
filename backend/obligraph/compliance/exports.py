"""CSV exports and the inspection-ready audit pack (zip)."""

from __future__ import annotations

import csv
import io
import json
import tempfile
import uuid
import zipfile
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from obligraph.compliance import evidence as evidence_store
from obligraph.compliance.filings import display_status
from obligraph.models import (
    ApprovalRequest,
    AuditEvent,
    Document,
    Evidence,
    Filing,
    Obligation,
    Org,
    Regulation,
    Requirement,
    ReturnType,
    Task,
    User,
)

DATASETS = ("obligations", "tasks", "approvals", "evidence", "filings", "activity", "policies")


async def _names(session: AsyncSession) -> dict[uuid.UUID, str]:
    return {u.id: u.name for u in (await session.execute(select(User))).scalars()}


async def rows(session: AsyncSession, org: Org, dataset: str) -> list[dict]:
    names = await _names(session)

    def who(uid):
        return names.get(uid, "") if uid else ""

    if dataset == "obligations":
        res = await session.execute(
            select(Obligation, Requirement, Regulation)
            .join(Requirement, Requirement.id == Obligation.requirement_id)
            .join(Regulation, Regulation.id == Requirement.regulation_id)
            .where(Obligation.org_id == org.id)
            .order_by(Regulation.regulator, Regulation.issued_on, Requirement.ordinal)
        )
        return [
            {
                "obligation_id": o.id,
                "regulator": r.regulator,
                "instrument": r.title,
                "ref_no": r.ref_no,
                "requirement": q.text,
                "severity": q.severity,
                "frequency": q.frequency,
                "due_on": q.due_on,
                "status": o.status,
                "retired_reason": o.retired_reason,
                "coverage": o.coverage,
                "confidence": o.confidence,
                "gap": o.rationale,
                "remediation": o.remediation,
                "evidence_quotes": " | ".join(e["quote"] for e in o.evidence),
                "owner": who(o.owner_id),
                "assessed_by": o.assessed_by,
                "assessed_at": o.assessed_at,
            }
            for o, q, r in res
        ]
    if dataset == "tasks":
        res = await session.execute(
            select(Task).where(Task.org_id == org.id).order_by(Task.created_at)
        )
        return [
            {
                "task_id": t.id,
                "title": t.title,
                "status": t.status,
                "priority": t.priority,
                "due_on": t.due_on,
                "assignee": who(t.assignee_id),
                "source": t.source,
                "obligation_id": t.obligation_id,
                "created_at": t.created_at,
                "completed_at": t.completed_at,
            }
            for t in res.scalars()
        ]
    if dataset == "approvals":
        res = await session.execute(
            select(ApprovalRequest, Task.title)
            .join(Task, Task.id == ApprovalRequest.task_id)
            .where(ApprovalRequest.org_id == org.id)
            .order_by(ApprovalRequest.created_at)
        )
        return [
            {
                "approval_id": a.id,
                "task": title,
                "status": a.status,
                "level": a.level,
                "maker": who(a.maker_id),
                "checker": who(a.checker_id),
                "maker_note": a.maker_note,
                "checker_note": a.checker_note,
                "submitted_at": a.created_at,
                "decided_at": a.decided_at,
                "history": json.dumps(a.history),
            }
            for a, title in res
        ]
    if dataset == "evidence":
        res = await session.execute(
            select(Evidence).where(Evidence.org_id == org.id).order_by(Evidence.created_at)
        )
        return [
            {
                "evidence_id": e.id,
                "filename": e.filename,
                "sha256": e.sha256,
                "size_bytes": e.size_bytes,
                "task_id": e.task_id,
                "obligation_id": e.obligation_id,
                "filing_id": e.filing_id,
                "note": e.note,
                "uploaded_by": who(e.uploaded_by),
                "uploaded_at": e.created_at,
            }
            for e in res.scalars()
        ]
    if dataset == "filings":
        res = await session.execute(
            select(Filing, ReturnType)
            .join(ReturnType, ReturnType.id == Filing.return_type_id)
            .where(Filing.org_id == org.id)
            .order_by(Filing.due_on)
        )
        return [
            {
                "filing_id": f.id,
                "return": rt.name,
                "code": rt.code,
                "regulator": rt.regulator,
                "period_start": f.period_start,
                "period_end": f.period_end,
                "due_on": f.due_on,
                "status": display_status(f),
                "filed_on": f.filed_on,
                "reference": f.reference,
                "filed_by": who(f.filed_by),
                "note": f.note,
            }
            for f, rt in res
        ]
    if dataset == "activity":
        res = await session.execute(
            select(AuditEvent).where(AuditEvent.org_id == org.id).order_by(AuditEvent.created_at)
        )
        return [
            {
                "at": e.created_at,
                "actor": who(e.actor_id) or "Obligraph",
                "action": e.action,
                "target_type": e.target_type,
                "target_id": e.target_id,
                "data": json.dumps(e.data),
            }
            for e in res.scalars()
        ]
    if dataset == "policies":
        res = await session.execute(
            select(Document).where(Document.org_id == org.id, Document.kind == "policy")
        )
        return [
            {
                "document_id": d.id,
                "title": d.title,
                "filename": d.filename,
                "uploaded_by": who(d.uploaded_by),
                "uploaded_at": d.created_at,
                "characters": len(d.text),
            }
            for d in res.scalars()
        ]
    raise ValueError(f"unknown dataset {dataset}")


def to_csv(data: list[dict]) -> str:
    buf = io.StringIO()
    if not data:
        return ""
    writer = csv.DictWriter(buf, fieldnames=list(data[0]))
    writer.writeheader()
    for row in data:
        writer.writerow({k: "" if v is None else v for k, v in row.items()})
    return buf.getvalue()


async def audit_pack(session: AsyncSession, org: Org) -> tempfile.SpooledTemporaryFile:
    """A zip an inspector can work from: every register as CSV, every evidence file, and a
    manifest of SHA-256 hashes so tampering is detectable."""
    out = tempfile.SpooledTemporaryFile(max_size=50 * 1024 * 1024)
    manifest = {"org": org.name, "generated_at": datetime.now(UTC).isoformat(), "files": {}}
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for name in DATASETS:
            content = to_csv(await rows(session, org, name)).encode("utf-8")
            zf.writestr(f"{name}.csv", content)
            manifest["files"][f"{name}.csv"] = {"bytes": len(content)}
        for ev in (
            await session.execute(select(Evidence).where(Evidence.org_id == org.id))
        ).scalars():
            try:
                data = await evidence_store.read(ev)
            except OSError as exc:
                manifest["files"][f"evidence/{ev.id}"] = {"error": str(exc)}
                continue
            arc = f"evidence/{ev.id}_{ev.filename}"
            zf.writestr(arc, data)
            manifest["files"][arc] = {"sha256": ev.sha256, "bytes": ev.size_bytes}
        zf.writestr("manifest.json", json.dumps(manifest, indent=2, default=str))
        zf.writestr(
            "README.txt",
            f"Obligraph audit pack for {org.name}\nGenerated {manifest['generated_at']}\n\n"
            "Each register is a CSV file. Evidence files are under evidence/, named "
            "<evidence id>_<original name>; manifest.json lists their SHA-256 hashes as "
            "recorded at upload.\n",
        )
    out.seek(0)
    return out
