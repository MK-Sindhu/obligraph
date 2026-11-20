"""Filings tracker, readiness packs, SBR layer view and the board report pack."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from sqlalchemy import select

from obligraph import vocab
from obligraph.api.deps import Caller, caller, requires
from obligraph.api.routes.work import evidence_out
from obligraph.api.schemas import (
    FileIn,
    FilingOut,
    ReturnTypeIn,
    ReturnTypeOut,
    ReturnTypeUpdate,
    WaiveIn,
)
from obligraph.audit import record
from obligraph.compliance import filings, packs, report
from obligraph.models import Evidence, Filing, ReturnType

router = APIRouter(tags=["oversight"])


# --------------------------------------------------------------------------- returns


@router.get("/returns", response_model=list[ReturnTypeOut])
async def list_returns(c: Caller = Depends(caller)) -> list[ReturnTypeOut]:
    await filings.ensure_filings(c.session, c.org)
    types = await filings.applicable_types(c.session, c.org)
    next_due = dict(
        (
            await c.session.execute(
                select(Filing.return_type_id, Filing.due_on)
                .where(
                    Filing.org_id == c.org.id,
                    Filing.status == "pending",
                    Filing.due_on >= date.today(),
                )
                .order_by(Filing.due_on.desc())
            )
        ).all()
    )
    out = []
    for rt in sorted(types, key=lambda r: (r.regulator, r.name)):
        o = ReturnTypeOut.model_validate(rt)
        o.custom = rt.org_id is not None
        o.next_due_on = next_due.get(rt.id)
        out.append(o)
    return out


@router.post("/returns", response_model=ReturnTypeOut, status_code=201)
async def create_return(
    body: ReturnTypeIn, c: Caller = Depends(requires("admin"))
) -> ReturnTypeOut:
    regulator = vocab.canonical_regulator(body.regulator) or body.regulator.strip()
    exists = (
        await c.session.execute(
            select(ReturnType.id).where(ReturnType.org_id == c.org.id, ReturnType.code == body.code)
        )
    ).first()
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "a return with this code exists")
    rt = ReturnType(
        id=uuid.uuid4(),
        org_id=c.org.id,
        code=body.code,
        name=body.name,
        regulator=regulator,
        frequency=body.frequency,
        due_days=body.due_days,
        description=body.description,
        portal=body.portal,
        sample=False,
        active=True,
        entity_classes=[],
        layers=[],
    )
    c.session.add(rt)
    await c.session.flush()
    await filings.ensure_filings(c.session, c.org)
    await record(
        c.session,
        org_id=c.org.id,
        actor_id=c.user.id,
        action="return.created",
        target_type="return_type",
        target_id=rt.id,
        data={"code": rt.code},
    )
    o = ReturnTypeOut.model_validate(rt)
    o.custom = True
    return o


@router.patch("/returns/{return_id}", response_model=ReturnTypeOut)
async def update_return(
    return_id: uuid.UUID, body: ReturnTypeUpdate, c: Caller = Depends(requires("admin"))
) -> ReturnTypeOut:
    rt = await c.session.get(ReturnType, return_id)
    if rt is None or rt.org_id != c.org.id:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "custom return not found (catalogue entries are read-only)"
        )
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(rt, k, v)
    await c.session.flush()
    o = ReturnTypeOut.model_validate(rt)
    o.custom = True
    return o


async def _filing_rows(c: Caller, stmt) -> list[FilingOut]:
    rows = (await c.session.execute(stmt)).all()
    ids = [f.id for f, _rt in rows]
    evs = (
        (await c.session.execute(select(Evidence).where(Evidence.filing_id.in_(ids))))
        .scalars()
        .all()
        if ids
        else []
    )
    ev_out = {e.id: e for e in await evidence_out(c, list(evs))}
    by_filing: dict[uuid.UUID, list] = {}
    for e in evs:
        by_filing.setdefault(e.filing_id, []).append(ev_out[e.id])
    return [
        FilingOut(
            id=f.id,
            return_type_id=rt.id,
            code=rt.code,
            name=rt.name,
            regulator=rt.regulator,
            frequency=rt.frequency,
            period_start=f.period_start,
            period_end=f.period_end,
            due_on=f.due_on,
            status=filings.display_status(f),
            filed_on=f.filed_on,
            reference=f.reference,
            note=f.note,
            sample=rt.sample,
            evidence=by_filing.get(f.id, []),
        )
        for f, rt in rows
    ]


def _filing_query(c: Caller):
    return (
        select(Filing, ReturnType)
        .join(ReturnType, ReturnType.id == Filing.return_type_id)
        .where(Filing.org_id == c.org.id)
    )


@router.get("/filings", response_model=list[FilingOut])
async def list_filings(
    c: Caller = Depends(caller),
    start: date | None = None,
    end: date | None = None,
    status_: str | None = Query(None, alias="status"),
) -> list[FilingOut]:
    await filings.ensure_filings(c.session, c.org)
    start = start or date.today() - timedelta(days=90)
    end = end or date.today() + timedelta(days=90)
    stmt = _filing_query(c).where(Filing.due_on >= start, Filing.due_on <= end)
    today = date.today()
    if status_ == "overdue":
        stmt = stmt.where(Filing.status == "pending", Filing.due_on < today)
    elif status_ == "pending":
        stmt = stmt.where(Filing.status == "pending", Filing.due_on >= today)
    elif status_ in ("filed", "waived"):
        stmt = stmt.where(Filing.status == status_)
    elif status_ == "late":
        stmt = stmt.where(Filing.status == "filed", Filing.filed_on > Filing.due_on)
    return await _filing_rows(c, stmt.order_by(Filing.due_on, ReturnType.name))


async def _own_filing(c: Caller, filing_id: uuid.UUID) -> Filing:
    f = await c.session.get(Filing, filing_id)
    if f is None or f.org_id != c.org.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "filing not found")
    return f


@router.post("/filings/{filing_id}/file", response_model=FilingOut)
async def mark_filed(
    filing_id: uuid.UUID, body: FileIn, c: Caller = Depends(requires("member"))
) -> FilingOut:
    f = await _own_filing(c, filing_id)
    if f.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, f"filing is already {f.status}")
    if body.filed_on > date.today():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "filed_on is in the future")
    if body.evidence_id:
        ev = await c.session.get(Evidence, body.evidence_id)
        if ev is None or ev.org_id != c.org.id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "unknown evidence")
        ev.filing_id = f.id
    f.status, f.filed_on, f.reference, f.note, f.filed_by = (
        "filed",
        body.filed_on,
        body.reference,
        body.note,
        c.user.id,
    )
    await record(
        c.session,
        org_id=c.org.id,
        actor_id=c.user.id,
        action="filing.filed",
        target_type="filing",
        target_id=f.id,
        data={"reference": body.reference, "late": body.filed_on > f.due_on},
    )
    await c.session.flush()
    return (await _filing_rows(c, _filing_query(c).where(Filing.id == f.id)))[0]


@router.post("/filings/{filing_id}/waive", response_model=FilingOut)
async def waive(
    filing_id: uuid.UUID, body: WaiveIn, c: Caller = Depends(requires("admin"))
) -> FilingOut:
    f = await _own_filing(c, filing_id)
    if f.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, f"filing is already {f.status}")
    f.status, f.note = "waived", body.note
    await record(
        c.session,
        org_id=c.org.id,
        actor_id=c.user.id,
        action="filing.waived",
        target_type="filing",
        target_id=f.id,
        data={"note": body.note},
    )
    await c.session.flush()
    return (await _filing_rows(c, _filing_query(c).where(Filing.id == f.id)))[0]


@router.post("/filings/{filing_id}/reopen", response_model=FilingOut)
async def reopen(filing_id: uuid.UUID, c: Caller = Depends(requires("admin"))) -> FilingOut:
    f = await _own_filing(c, filing_id)
    f.status, f.filed_on, f.reference, f.filed_by = "pending", None, "", None
    await record(
        c.session,
        org_id=c.org.id,
        actor_id=c.user.id,
        action="filing.reopened",
        target_type="filing",
        target_id=f.id,
    )
    await c.session.flush()
    return (await _filing_rows(c, _filing_query(c).where(Filing.id == f.id)))[0]


# --------------------------------------------------------------------------- packs / SBR


@router.get("/packs")
async def list_packs(c: Caller = Depends(caller)) -> list[dict]:
    return await packs.summaries(c.session, c.org)


@router.get("/packs/{key}")
async def pack_detail(key: str, c: Caller = Depends(caller)) -> dict:
    if key not in packs.PACKS_BY_KEY:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown pack")
    return await packs.detail(c.session, c.org, key)


@router.get("/sbr")
async def sbr(
    c: Caller = Depends(caller),
    target: str | None = Query(None, pattern="^(base|middle|upper|top)$"),
) -> dict:
    return await packs.sbr_view(c.session, c.org, target)


# --------------------------------------------------------------------------- board pack


def _period(start: date | None, end: date | None) -> tuple[date, date]:
    d_start, d_end = report.default_period()
    start, end = start or d_start, end or d_end
    if end < start or (end - start).days > 400:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "period must be 0-400 days")
    return start, end


@router.get("/reports/board-pack")
async def board_pack(
    c: Caller = Depends(caller), start: date | None = None, end: date | None = None
) -> dict:
    s, e = _period(start, end)
    return await report.build(c.session, c.org, s, e)


@router.get("/reports/board-pack.html", response_class=HTMLResponse)
async def board_pack_html(
    c: Caller = Depends(caller), start: date | None = None, end: date | None = None
) -> HTMLResponse:
    s, e = _period(start, end)
    data = await report.build(c.session, c.org, s, e)
    await record(
        c.session,
        org_id=c.org.id,
        actor_id=c.user.id,
        action="report.board_pack",
        data={"start": s.isoformat(), "end": e.isoformat()},
    )
    return HTMLResponse(report.to_html(data))
