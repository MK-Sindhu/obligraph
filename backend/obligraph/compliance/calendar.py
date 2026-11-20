"""Compliance calendar: hard deadlines, recurring obligations and task due dates.

Recurring obligations repeat from an anchor date (the requirement's own due date, else
the instrument's effective date, else its issue date) at their stated frequency.
"""

from __future__ import annotations

import calendar as _cal
import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from obligraph import clock
from obligraph.models import Filing, Obligation, Regulation, Requirement, ReturnType, Task

PERIOD_MONTHS = {"monthly": 1, "quarterly": 3, "half_yearly": 6, "annual": 12}


def add_months(d: date, months: int) -> date:
    y, m = divmod(d.month - 1 + months, 12)
    year, month = d.year + y, m + 1
    return date(year, month, min(d.day, _cal.monthrange(year, month)[1]))


def occurrences(anchor: date, months: int, start: date, end: date, cap: int = 400) -> list[date]:
    if anchor > end:
        return []
    k = 0
    if anchor < start:
        gap = (start.year - anchor.year) * 12 + (start.month - anchor.month)
        k = max(0, gap // months - 1)
    out = []
    while len(out) < cap:
        d = add_months(anchor, k * months)
        if d > end:
            break
        if d >= start:
            out.append(d)
        k += 1
    return out


async def events(session: AsyncSession, org_id: uuid.UUID, start: date, end: date) -> list[dict]:
    today = clock.today()
    rows = (
        await session.execute(
            select(Obligation, Requirement, Regulation)
            .join(Requirement, Requirement.id == Obligation.requirement_id)
            .join(Regulation, Regulation.id == Requirement.regulation_id)
            .where(Obligation.org_id == org_id, Obligation.status != "not_applicable")
        )
    ).all()
    out: list[dict] = []
    for ob, req, reg in rows:
        base = {
            "obligation_id": str(ob.id),
            "task_id": None,
            "regulation_id": str(reg.id),
            "regulation_title": reg.title,
            "regulator": reg.regulator,
            "title": req.text,
            "severity": req.severity,
            "status": ob.status,
            "coverage": ob.coverage,
        }
        months = PERIOD_MONTHS.get(req.frequency)
        if months:
            anchor = req.due_on or reg.effective_on or reg.issued_on
            if anchor:
                for d in occurrences(anchor, months, start, end):
                    out.append(
                        {
                            **base,
                            "date": d.isoformat(),
                            "kind": "recurring",
                            "frequency": req.frequency,
                            "overdue": d < today and ob.status != "met",
                        }
                    )
        elif req.due_on and start <= req.due_on <= end:
            out.append(
                {
                    **base,
                    "date": req.due_on.isoformat(),
                    "kind": "deadline",
                    "frequency": req.frequency,
                    "overdue": req.due_on < today and ob.status != "met",
                }
            )

    tasks = (
        await session.execute(
            select(Task).where(
                Task.org_id == org_id,
                Task.due_on.is_not(None),
                Task.due_on >= start,
                Task.due_on <= end,
            )
        )
    ).scalars()
    for t in tasks:
        out.append(
            {
                "date": t.due_on.isoformat(),
                "kind": "task",
                "title": t.title,
                "task_id": str(t.id),
                "obligation_id": str(t.obligation_id) if t.obligation_id else None,
                "regulation_id": None,
                "regulation_title": None,
                "regulator": None,
                "severity": {"urgent": "critical"}.get(t.priority, t.priority),
                "status": t.status,
                "coverage": None,
                "frequency": None,
                "overdue": t.due_on < today and t.status != "done",
            }
        )
    filings = (
        await session.execute(
            select(Filing, ReturnType)
            .join(ReturnType, ReturnType.id == Filing.return_type_id)
            .where(Filing.org_id == org_id, Filing.due_on >= start, Filing.due_on <= end)
        )
    ).all()
    for f, rt in filings:
        done = f.status in ("filed", "waived")
        out.append(
            {
                "date": f.due_on.isoformat(),
                "kind": "filing",
                "title": f"{rt.name} ({f.period_start:%b %Y}"
                + (
                    f" - {f.period_end:%b %Y})"
                    if f.period_end.month != f.period_start.month
                    or f.period_end.year != f.period_start.year
                    else ")"
                ),
                "task_id": None,
                "obligation_id": None,
                "filing_id": str(f.id),
                "regulation_id": None,
                "regulation_title": None,
                "regulator": rt.regulator,
                "severity": "high",
                "status": f.status,
                "coverage": None,
                "frequency": rt.frequency,
                "overdue": f.due_on < today and not done,
            }
        )
    out.sort(key=lambda e: (e["date"], e["kind"]))
    return out
