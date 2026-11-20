"""Evidence, exports and maker-checker approvals."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select

from obligraph.api.deps import Caller, caller, requires
from obligraph.api.schemas import ApprovalOut, DecisionIn, EvidenceOut, SubmitIn
from obligraph.audit import record
from obligraph.compliance import approvals, exports
from obligraph.compliance import evidence as store
from obligraph.models import ApprovalRequest, Evidence, Filing, Obligation, Requirement, Task, User
from obligraph.security import role_at_least
from obligraph.settings import get_settings

router = APIRouter(tags=["work"])


# --------------------------------------------------------------------------- evidence


async def evidence_out(c: Caller, items: list[Evidence]) -> list[EvidenceOut]:
    ids = {e.uploaded_by for e in items if e.uploaded_by}
    names = (
        {
            u.id: u.name
            for u in (await c.session.execute(select(User).where(User.id.in_(ids)))).scalars()
        }
        if ids
        else {}
    )
    out = []
    for e in items:
        o = EvidenceOut.model_validate(e)
        o.uploaded_by_name = names.get(e.uploaded_by)
        out.append(o)
    return out


async def _check_owned(c: Caller, model, obj_id: uuid.UUID | None, label: str) -> None:
    if obj_id is None:
        return
    obj = await c.session.get(model, obj_id)
    if obj is None or obj.org_id != c.org.id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"unknown {label}")


@router.post("/evidence", response_model=EvidenceOut, status_code=201)
async def upload_evidence(
    file: UploadFile = File(...),
    task_id: uuid.UUID | None = Form(None),
    obligation_id: uuid.UUID | None = Form(None),
    filing_id: uuid.UUID | None = Form(None),
    note: str = Form(""),
    c: Caller = Depends(requires("member")),
) -> EvidenceOut:
    await _check_owned(c, Task, task_id, "task")
    await _check_owned(c, Obligation, obligation_id, "obligation")
    await _check_owned(c, Filing, filing_id, "filing")
    data = await file.read(get_settings().upload_limit_bytes + 1)
    try:
        ev = await store.save(
            c.session,
            org_id=c.org.id,
            filename=file.filename or "evidence",
            content_type=file.content_type,
            data=data,
            uploaded_by=c.user.id,
            task_id=task_id,
            obligation_id=obligation_id,
            filing_id=filing_id,
            note=note,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    await record(
        c.session,
        org_id=c.org.id,
        actor_id=c.user.id,
        action="evidence.uploaded",
        target_type="evidence",
        target_id=ev.id,
        data={"filename": ev.filename, "sha256": ev.sha256},
    )
    return (await evidence_out(c, [ev]))[0]


@router.get("/evidence", response_model=list[EvidenceOut])
async def list_evidence(
    c: Caller = Depends(caller),
    task_id: uuid.UUID | None = None,
    obligation_id: uuid.UUID | None = None,
    filing_id: uuid.UUID | None = None,
    limit: int = Query(200, le=500),
) -> list[EvidenceOut]:
    stmt = select(Evidence).where(Evidence.org_id == c.org.id)
    if task_id:
        stmt = stmt.where(Evidence.task_id == task_id)
    if obligation_id:
        stmt = stmt.where(Evidence.obligation_id == obligation_id)
    if filing_id:
        stmt = stmt.where(Evidence.filing_id == filing_id)
    items = (
        (await c.session.execute(stmt.order_by(Evidence.created_at.desc()).limit(limit)))
        .scalars()
        .all()
    )
    return await evidence_out(c, list(items))


@router.get("/evidence/{evidence_id}/download")
async def download_evidence(evidence_id: uuid.UUID, c: Caller = Depends(caller)) -> Response:
    ev = await c.session.get(Evidence, evidence_id)
    if ev is None or ev.org_id != c.org.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "evidence not found")
    try:
        data = await store.read(ev, c.session)
    except OSError as exc:
        raise HTTPException(status.HTTP_410_GONE, str(exc)) from exc
    safe = ev.filename.replace('"', "")
    return Response(
        data,
        media_type=ev.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{safe}"',
            "X-Content-SHA256": ev.sha256,
        },
    )


@router.delete("/evidence/{evidence_id}", status_code=204)
async def delete_evidence(evidence_id: uuid.UUID, c: Caller = Depends(requires("admin"))) -> None:
    ev = await c.session.get(Evidence, evidence_id)
    if ev is None or ev.org_id != c.org.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "evidence not found")
    in_use = (
        await c.session.execute(
            select(ApprovalRequest.id).where(
                ApprovalRequest.org_id == c.org.id,
                ApprovalRequest.status == "approved",
                ApprovalRequest.evidence_ids.contains([str(ev.id)]),
            )
        )
    ).first()
    if in_use:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "evidence backs an approved decision and cannot be deleted"
        )
    await record(
        c.session,
        org_id=c.org.id,
        actor_id=c.user.id,
        action="evidence.deleted",
        target_type="evidence",
        target_id=ev.id,
        data={"filename": ev.filename, "sha256": ev.sha256},
    )
    await c.session.delete(ev)
    await c.session.flush()
    await store.remove_file(ev)


# --------------------------------------------------------------------------- exports


@router.get("/exports/audit-pack.zip")
async def audit_pack(c: Caller = Depends(requires("admin"))) -> StreamingResponse:
    zipped = await exports.audit_pack(c.session, c.org)
    await record(c.session, org_id=c.org.id, actor_id=c.user.id, action="export.audit_pack")
    stamp = datetime.now(UTC).strftime("%Y%m%d")
    return StreamingResponse(
        zipped,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="obligraph-audit-{c.org.slug}-{stamp}.zip"'
        },
    )


@router.get("/exports/{dataset}.csv")
async def export_csv(dataset: str, c: Caller = Depends(requires("member"))) -> Response:
    if dataset not in exports.DATASETS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"datasets: {', '.join(exports.DATASETS)}")
    body = exports.to_csv(await exports.rows(c.session, c.org, dataset))
    return Response(
        body,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{c.org.slug}-{dataset}.csv"'},
    )


# --------------------------------------------------------------------------- approvals


async def approval_out(
    c: Caller, a: ApprovalRequest, *, with_workflow: bool = False
) -> ApprovalOut:
    task = await c.session.get(Task, a.task_id)
    names = {
        u.id: u.name
        for u in (
            await c.session.execute(
                select(User).where(User.id.in_([x for x in (a.maker_id, a.checker_id) if x]))
            )
        ).scalars()
    }
    ev_ids = [uuid.UUID(x) for x in a.evidence_ids]
    evs = (
        (await c.session.execute(select(Evidence).where(Evidence.id.in_(ev_ids)))).scalars().all()
        if ev_ids
        else []
    )
    needed = approvals.LEVEL_ROLE[a.level]
    return ApprovalOut(
        id=a.id,
        task_id=a.task_id,
        task_title=task.title if task else "(deleted task)",
        status=a.status,
        level=a.level,
        required_role=needed,
        maker=names.get(a.maker_id),
        maker_id=a.maker_id,
        checker=names.get(a.checker_id),
        maker_note=a.maker_note,
        checker_note=a.checker_note,
        evidence=await evidence_out(c, list(evs)),
        history=a.history,
        due_at=a.due_at,
        overdue=a.status == "pending" and a.due_at < datetime.now(UTC),
        created_at=a.created_at,
        decided_at=a.decided_at,
        can_decide=a.status == "pending"
        and a.maker_id != c.user.id
        and role_at_least(c.role, needed),
        workflow=await approvals.workflow_state(a.id) if with_workflow else None,
    )


@router.post("/tasks/{task_id}/submit", response_model=ApprovalOut, status_code=201)
async def submit_for_approval(
    task_id: uuid.UUID, body: SubmitIn, c: Caller = Depends(requires("member"))
) -> ApprovalOut:
    task = await c.session.get(Task, task_id)
    if task is None or task.org_id != c.org.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "task not found")
    for eid in body.evidence_ids:
        await _check_owned(c, Evidence, eid, "evidence")
    try:
        appr = await approvals.submit(
            c.session,
            org=c.org,
            task=task,
            maker=c.user,
            note=body.note,
            evidence_ids=body.evidence_ids,
        )
    except approvals.ApprovalError as exc:
        raise HTTPException(exc.status, str(exc)) from exc
    return await approval_out(c, appr)


@router.get("/approvals", response_model=list[ApprovalOut])
async def list_approvals(
    c: Caller = Depends(caller),
    status_: str | None = Query(None, alias="status"),
    inbox: bool = Query(False, description="Only requests I can decide."),
    task_id: uuid.UUID | None = None,
    limit: int = Query(100, le=300),
) -> list[ApprovalOut]:
    stmt = select(ApprovalRequest).where(ApprovalRequest.org_id == c.org.id)
    if status_:
        stmt = stmt.where(ApprovalRequest.status == status_)
    if task_id:
        stmt = stmt.where(ApprovalRequest.task_id == task_id)
    rows = (
        (await c.session.execute(stmt.order_by(ApprovalRequest.created_at.desc()).limit(limit)))
        .scalars()
        .all()
    )
    out = [await approval_out(c, a) for a in rows]
    return [a for a in out if a.can_decide] if inbox else out


async def _own_approval(c: Caller, approval_id: uuid.UUID) -> ApprovalRequest:
    a = await c.session.get(ApprovalRequest, approval_id)
    if a is None or a.org_id != c.org.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "approval not found")
    return a


@router.get("/approvals/{approval_id}", response_model=ApprovalOut)
async def get_approval(approval_id: uuid.UUID, c: Caller = Depends(caller)) -> ApprovalOut:
    return await approval_out(c, await _own_approval(c, approval_id), with_workflow=True)


@router.post("/approvals/{approval_id}/{action}", response_model=ApprovalOut)
async def decide(
    approval_id: uuid.UUID,
    action: approvals.Action,
    body: DecisionIn,
    c: Caller = Depends(requires("member")),
) -> ApprovalOut:
    a = await _own_approval(c, approval_id)
    if action == "escalate" and not role_at_least(c.role, "admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "only admins can escalate manually")
    try:
        a = await approvals.decide(
            c.session,
            appr=a,
            action=action,
            actor=c.user,
            note=body.note,
        )
    except approvals.ApprovalError as exc:
        raise HTTPException(exc.status, str(exc)) from exc
    return await approval_out(c, a)


async def task_flags(
    c: Caller, tasks: list[Task]
) -> dict[uuid.UUID, tuple[bool, uuid.UUID | None]]:
    """(requires_approval, pending approval id) for each task, for task listings."""
    if not tasks:
        return {}
    pending = dict(
        (
            await c.session.execute(
                select(ApprovalRequest.task_id, ApprovalRequest.id).where(
                    ApprovalRequest.org_id == c.org.id,
                    ApprovalRequest.status == "pending",
                    ApprovalRequest.task_id.in_([t.id for t in tasks]),
                )
            )
        ).all()
    )
    severity = dict(
        (
            await c.session.execute(
                select(Obligation.id, Requirement.severity)
                .join(Requirement, Requirement.id == Obligation.requirement_id)
                .where(Obligation.id.in_([t.obligation_id for t in tasks if t.obligation_id]))
            )
        ).all()
    )
    return {
        t.id: (
            approvals.requires_approval(c.org, t, severity.get(t.obligation_id)),
            pending.get(t.id),
        )
        for t in tasks
    }
