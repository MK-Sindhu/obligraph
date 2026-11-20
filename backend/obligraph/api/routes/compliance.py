"""Org-scoped compliance work: policies, obligations, tasks."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import case, delete, func, select

from obligraph.api.deps import Caller, caller, requires
from obligraph.api.schemas import (
    ObligationOut,
    ObligationUpdate,
    Page,
    PolicyOut,
    RegulationSummary,
    RequirementOut,
    TaskCreate,
    TaskOut,
    TaskUpdate,
)
from obligraph.audit import record
from obligraph.ingest.documents import UnsupportedDocument, bytes_to_text, guess_title
from obligraph.ingest.pipeline import store_document
from obligraph.jobs import enqueue
from obligraph.models import Chunk, Document, Membership, Obligation, Regulation, Requirement, Task
from obligraph.settings import get_settings

router = APIRouter(tags=["compliance"])


# --------------------------------------------------------------------------- policies


@router.get("/policies", response_model=list[PolicyOut])
async def list_policies(c: Caller = Depends(caller)) -> list[PolicyOut]:
    rows = (
        await c.session.execute(
            select(Document, func.length(Document.text), func.count(Chunk.id))
            .outerjoin(Chunk, Chunk.document_id == Document.id)
            .where(Document.org_id == c.org.id, Document.kind == "policy")
            .group_by(Document.id)
            .order_by(Document.created_at.desc())
        )
    ).all()
    out = []
    for doc, chars, chunks in rows:
        p = PolicyOut.model_validate(doc)
        p.chars, p.chunks = chars, chunks
        out.append(p)
    return out


@router.post("/policies", response_model=PolicyOut, status_code=201)
async def upload_policy(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    c: Caller = Depends(requires("admin")),
) -> PolicyOut:
    limit = get_settings().upload_limit_bytes
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE, f"file larger than {limit // (1024 * 1024)} MB"
        )
    try:
        text = bytes_to_text(file.filename or "policy.txt", data, file.content_type)
    except UnsupportedDocument as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    doc, created = await store_document(
        c.session,
        kind="policy",
        org_id=c.org.id,
        title=title or guess_title(file.filename, text),
        text=text,
        filename=file.filename,
        uploaded_by=c.user.id,
    )
    if not created:
        raise HTTPException(status.HTTP_409_CONFLICT, f"already uploaded as '{doc.title}'")
    await enqueue(
        c.session, "assess_org", {"org_id": str(c.org.id)}, dedupe_key=f"assess_org:{c.org.id}"
    )
    await record(
        c.session,
        org_id=c.org.id,
        actor_id=c.user.id,
        action="policy.uploaded",
        target_type="document",
        target_id=doc.id,
        data={"title": doc.title},
    )
    chunks = (
        await c.session.execute(select(func.count()).where(Chunk.document_id == doc.id))
    ).scalar_one()
    out = PolicyOut.model_validate(doc)
    out.chars, out.chunks = len(text), chunks
    return out


@router.delete("/policies/{document_id}", status_code=204)
async def delete_policy(document_id: uuid.UUID, c: Caller = Depends(requires("admin"))) -> None:
    doc = await c.session.get(Document, document_id)
    if doc is None or doc.org_id != c.org.id or doc.kind != "policy":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "policy not found")
    await c.session.delete(doc)
    await enqueue(
        c.session, "assess_org", {"org_id": str(c.org.id)}, dedupe_key=f"assess_org:{c.org.id}"
    )
    await record(
        c.session,
        org_id=c.org.id,
        actor_id=c.user.id,
        action="policy.deleted",
        target_type="document",
        target_id=document_id,
        data={"title": doc.title},
    )


# --------------------------------------------------------------------------- obligations


async def _obligation_out(c: Caller, rows) -> list[ObligationOut]:
    ids = [o.id for o, _q, _r in rows]
    open_tasks = (
        dict(
            (
                await c.session.execute(
                    select(Task.obligation_id, func.count())
                    .where(Task.obligation_id.in_(ids), Task.status != "done")
                    .group_by(Task.obligation_id)
                )
            ).all()
        )
        if ids
        else {}
    )
    out = []
    for o, q, r in rows:
        out.append(
            ObligationOut(
                id=o.id,
                status=o.status,
                coverage=o.coverage,
                confidence=o.confidence,
                rationale=o.rationale,
                remediation=o.remediation,
                evidence=o.evidence,
                assessed_by=o.assessed_by,
                assessed_at=o.assessed_at,
                owner_id=o.owner_id,
                requirement=RequirementOut.model_validate(q),
                regulation=RegulationSummary.model_validate(r),
                open_tasks=open_tasks.get(o.id, 0),
            )
        )
    return out


def _obligation_query(c: Caller):
    return (
        select(Obligation, Requirement, Regulation)
        .join(Requirement, Requirement.id == Obligation.requirement_id)
        .join(Regulation, Regulation.id == Requirement.regulation_id)
        .where(Obligation.org_id == c.org.id)
    )


@router.get("/obligations", response_model=Page[ObligationOut])
async def list_obligations(
    c: Caller = Depends(caller),
    coverage: str | None = None,
    status_: str | None = Query(None, alias="status"),
    severity: str | None = None,
    regulator: str | None = None,
    topic: str | None = None,
    regulation_id: uuid.UUID | None = None,
    q: str | None = None,
    include_retired: bool = False,
    limit: int = Query(50, le=200),
    offset: int = 0,
) -> Page[ObligationOut]:
    stmt = _obligation_query(c)
    if not include_retired:
        stmt = stmt.where(Obligation.status != "not_applicable")
    if coverage:
        stmt = stmt.where(Obligation.coverage == coverage)
    if status_:
        stmt = stmt.where(Obligation.status == status_)
    if severity:
        stmt = stmt.where(Requirement.severity == severity)
    if regulator:
        stmt = stmt.where(Regulation.regulator == regulator)
    if topic:
        stmt = stmt.where(Requirement.topics.any(topic))
    if regulation_id:
        stmt = stmt.where(Regulation.id == regulation_id)
    if q:
        stmt = stmt.where(Requirement.text.ilike(f"%{q}%") | Regulation.title.ilike(f"%{q}%"))
    total = (
        await c.session.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()
    severity_rank = case(
        {"critical": 0, "high": 1, "medium": 2, "low": 3}, value=Requirement.severity, else_=4
    )
    rows = (
        await c.session.execute(
            stmt.order_by(
                severity_rank, Regulation.issued_on.desc().nulls_last(), Requirement.ordinal
            )
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return Page(items=await _obligation_out(c, rows), total=total, limit=limit, offset=offset)


async def _load_obligation(c: Caller, obligation_id: uuid.UUID):
    row = (
        await c.session.execute(_obligation_query(c).where(Obligation.id == obligation_id))
    ).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "obligation not found")
    return row


@router.get("/obligations/{obligation_id}", response_model=ObligationOut)
async def get_obligation(obligation_id: uuid.UUID, c: Caller = Depends(caller)) -> ObligationOut:
    return (await _obligation_out(c, [await _load_obligation(c, obligation_id)]))[0]


@router.patch("/obligations/{obligation_id}", response_model=ObligationOut)
async def update_obligation(
    obligation_id: uuid.UUID, body: ObligationUpdate, c: Caller = Depends(requires("member"))
) -> ObligationOut:
    row = await _load_obligation(c, obligation_id)
    ob = row[0]
    changes = body.model_dump(exclude_unset=True)
    if "owner_id" in changes and changes["owner_id"] is not None:
        if await c.session.get(Membership, (changes["owner_id"], c.org.id)) is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "owner is not a member")
    for k, v in changes.items():
        setattr(ob, k, v)
    await record(
        c.session,
        org_id=c.org.id,
        actor_id=c.user.id,
        action="obligation.updated",
        target_type="obligation",
        target_id=ob.id,
        data={k: str(v) for k, v in changes.items()},
    )
    await c.session.flush()
    return (await _obligation_out(c, [row]))[0]


@router.post("/obligations/{obligation_id}/assess", status_code=202)
async def reassess(obligation_id: uuid.UUID, c: Caller = Depends(requires("member"))) -> dict:
    await _load_obligation(c, obligation_id)
    await enqueue(
        c.session,
        "assess_obligation",
        {"obligation_id": str(obligation_id)},
        dedupe_key=f"assess:{obligation_id}",
    )
    return {"queued": True}


@router.post("/obligations/assess-all", status_code=202)
async def reassess_all(c: Caller = Depends(requires("admin"))) -> dict:
    await enqueue(
        c.session, "assess_org", {"org_id": str(c.org.id)}, dedupe_key=f"assess_org:{c.org.id}"
    )
    return {"queued": True}


# --------------------------------------------------------------------------- tasks


@router.get("/tasks", response_model=list[TaskOut])
async def list_tasks(
    c: Caller = Depends(caller),
    status_: str | None = Query(None, alias="status"),
    obligation_id: uuid.UUID | None = None,
    assignee_id: uuid.UUID | None = None,
    limit: int = Query(200, le=500),
) -> list[TaskOut]:
    stmt = select(Task).where(Task.org_id == c.org.id)
    if status_:
        stmt = stmt.where(Task.status == status_)
    if obligation_id:
        stmt = stmt.where(Task.obligation_id == obligation_id)
    if assignee_id:
        stmt = stmt.where(Task.assignee_id == assignee_id)
    rows = (
        (
            await c.session.execute(
                stmt.order_by(Task.due_on.asc().nulls_last(), Task.created_at.desc()).limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return await tasks_out(c, list(rows))


async def tasks_out(c: Caller, tasks: list[Task]) -> list[TaskOut]:
    from obligraph.api.routes.work import task_flags

    flags = await task_flags(c, tasks)
    out = []
    for t in tasks:
        o = TaskOut.model_validate(t)
        o.requires_approval, o.approval_id = flags.get(t.id, (False, None))
        out.append(o)
    return out


async def task_flags_for(c: Caller, task: Task) -> tuple[bool, uuid.UUID | None]:
    from obligraph.api.routes.work import task_flags

    return (await task_flags(c, [task]))[task.id]


async def _check_refs(c: Caller, obligation_id, assignee_id) -> None:
    if obligation_id:
        ob = await c.session.get(Obligation, obligation_id)
        if ob is None or ob.org_id != c.org.id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "unknown obligation")
    if assignee_id and await c.session.get(Membership, (assignee_id, c.org.id)) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "assignee is not a member")


@router.post("/tasks", response_model=TaskOut, status_code=201)
async def create_task(body: TaskCreate, c: Caller = Depends(requires("member"))) -> TaskOut:
    await _check_refs(c, body.obligation_id, body.assignee_id)
    task = Task(id=uuid.uuid4(), org_id=c.org.id, source="manual", **body.model_dump())
    c.session.add(task)
    await c.session.flush()
    await c.session.refresh(task)
    await record(
        c.session,
        org_id=c.org.id,
        actor_id=c.user.id,
        action="task.created",
        target_type="task",
        target_id=task.id,
        data={"title": task.title},
    )
    return (await tasks_out(c, [task]))[0]


@router.patch("/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: uuid.UUID, body: TaskUpdate, c: Caller = Depends(requires("member"))
) -> TaskOut:
    task = await c.session.get(Task, task_id)
    if task is None or task.org_id != c.org.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "task not found")
    changes = body.model_dump(exclude_unset=True)
    await _check_refs(c, None, changes.get("assignee_id"))
    if "status" in changes and changes["status"] != task.status:
        needs, pending = await task_flags_for(c, task)
        if pending:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "this task is awaiting a checker's decision"
            )
        if needs and changes["status"] in ("review", "done"):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "high-impact task: submit it for maker-checker approval instead of closing it",
            )
    for k, v in changes.items():
        setattr(task, k, v)
    if "status" in changes:
        task.completed_at = datetime.now(UTC) if task.status == "done" else None
    if task.source == "ai" and changes:
        task.source = "ai_edited"  # keep it when the obligation is re-assessed
    await record(
        c.session,
        org_id=c.org.id,
        actor_id=c.user.id,
        action="task.updated",
        target_type="task",
        target_id=task.id,
        data={k: str(v) for k, v in changes.items()},
    )
    await c.session.flush()
    return (await tasks_out(c, [task]))[0]


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(task_id: uuid.UUID, c: Caller = Depends(requires("member"))) -> None:
    deleted = await c.session.execute(
        delete(Task).where(Task.id == task_id, Task.org_id == c.org.id).returning(Task.title)
    )
    title = deleted.scalar_one_or_none()
    if title is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "task not found")
    await record(
        c.session,
        org_id=c.org.id,
        actor_id=c.user.id,
        action="task.deleted",
        target_type="task",
        target_id=task_id,
        data={"title": title},
    )
