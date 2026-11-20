"""Periodic upkeep, run by the worker: escalations, overdue alerts, filings, snapshots."""

from __future__ import annotations

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from obligraph.compliance import approvals, filings, report
from obligraph.jobs import handler
from obligraph.models import Alert, Org, Task


async def overdue_task_alerts(session: AsyncSession, org: Org) -> int:
    """One alert per overdue task per day."""
    today = date.today()
    overdue = (
        (
            await session.execute(
                select(Task).where(
                    Task.org_id == org.id, Task.status != "done", Task.due_on < today
                )
            )
        )
        .scalars()
        .all()
    )
    raised = 0
    for t in overdue:
        exists = (
            await session.execute(
                select(Alert.id).where(
                    Alert.org_id == org.id,
                    Alert.kind == "task_overdue",
                    Alert.ref_id == t.id,
                    func.date(Alert.created_at) == today,
                )
            )
        ).first()
        if exists:
            continue
        days = (today - t.due_on).days
        session.add(
            Alert(
                org_id=org.id,
                kind="task_overdue",
                severity="critical" if t.priority == "urgent" or days > 30 else "high",
                title=f"Overdue by {days} day{'s' if days != 1 else ''}: {t.title[:140]}",
                body="Reassign it, change its due date, or escalate.",
                ref_type="task",
                ref_id=t.id,
            )
        )
        raised += 1
    return raised


async def run(session: AsyncSession) -> dict:
    escalated = await approvals.escalate_overdue(session)
    totals = {"escalated": escalated, "overdue_alerts": 0, "filings_created": 0}
    for org in (await session.execute(select(Org))).scalars().all():
        totals["overdue_alerts"] += await overdue_task_alerts(session, org)
        totals["filings_created"] += await filings.ensure_filings(session, org)
        await report.snapshot(session, org.id)
    return totals


@handler("housekeeping")
async def housekeeping_job(session: AsyncSession, payload: dict) -> None:
    await run(session)
