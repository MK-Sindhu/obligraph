"""Dashboard, compliance calendar, alerts."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, update

from obligraph import clock
from obligraph.api.deps import Caller, caller
from obligraph.api.schemas import AlertOut, CalendarEvent
from obligraph.compliance import calendar, dashboard
from obligraph.models import Alert

router = APIRouter(tags=["insights"])


@router.get("/dashboard")
async def get_dashboard(c: Caller = Depends(caller)) -> dict:
    return await dashboard.summary(c.session, c.org.id)


@router.get("/calendar", response_model=list[CalendarEvent])
async def get_calendar(
    c: Caller = Depends(caller),
    start: date | None = None,
    end: date | None = None,
) -> list[CalendarEvent]:
    start = start or clock.today().replace(day=1)
    end = end or start + timedelta(days=62)
    if end < start or (end - start).days > 400:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "window must be 0-400 days")
    return [CalendarEvent(**e) for e in await calendar.events(c.session, c.org.id, start, end)]


@router.get("/alerts", response_model=list[AlertOut])
async def list_alerts(
    c: Caller = Depends(caller), unread: bool = False, limit: int = Query(50, le=200)
) -> list[AlertOut]:
    stmt = select(Alert).where(Alert.org_id == c.org.id)
    if unread:
        stmt = stmt.where(Alert.read_at.is_(None))
    rows = (await c.session.execute(stmt.order_by(Alert.created_at.desc()).limit(limit))).scalars()
    return [AlertOut.model_validate(a) for a in rows]


@router.post("/alerts/{alert_id}/read", status_code=204)
async def mark_read(alert_id: uuid.UUID, c: Caller = Depends(caller)) -> None:
    await c.session.execute(
        update(Alert)
        .where(Alert.id == alert_id, Alert.org_id == c.org.id)
        .values(read_at=datetime.now(UTC))
    )


@router.post("/alerts/read-all", status_code=204)
async def mark_all_read(c: Caller = Depends(caller)) -> None:
    await c.session.execute(
        update(Alert)
        .where(Alert.org_id == c.org.id, Alert.read_at.is_(None))
        .values(read_at=datetime.now(UTC))
    )
