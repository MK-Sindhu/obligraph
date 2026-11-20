"""Org-level rollups for the dashboard: coverage, workload, risk heatmap."""

from __future__ import annotations

import uuid
from datetime import timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from obligraph import clock
from obligraph.compliance.calendar import events

SEVERITIES = ["critical", "high", "medium", "low"]


def coverage_pct(counts: dict[str, int]) -> float | None:
    assessed = counts.get("covered", 0) + counts.get("partial", 0) + counts.get("missing", 0)
    if not assessed:
        return None
    return round(100 * (counts.get("covered", 0) + 0.5 * counts.get("partial", 0)) / assessed, 1)


async def summary(session: AsyncSession, org_id: uuid.UUID) -> dict:
    p = {"org": org_id, "today": clock.today()}
    coverage = {
        k: n
        for k, n in await session.execute(
            text(
                "SELECT coverage, count(*) FROM obligations "
                "WHERE org_id = :org AND status <> 'not_applicable' GROUP BY coverage"
            ),
            p,
        )
    }
    status = {
        k: n
        for k, n in await session.execute(
            text("SELECT status, count(*) FROM obligations WHERE org_id = :org GROUP BY status"), p
        )
    }
    tasks = (
        await session.execute(
            text("""SELECT count(*) FILTER (WHERE status <> 'done'),
                           count(*) FILTER (WHERE status <> 'done' AND due_on < :today),
                           count(*) FILTER (WHERE status = 'done')
                    FROM tasks WHERE org_id = :org"""),
            p,
        )
    ).one()
    regs = (
        await session.execute(
            text("""SELECT count(DISTINCT q.regulation_id) FROM obligations o
                    JOIN requirements q ON q.id = o.requirement_id
                    WHERE o.org_id = :org AND o.status <> 'not_applicable'"""),
            p,
        )
    ).scalar_one()

    # Heatmap: open gaps (missing/partial) by topic x severity, and by regulator x severity.
    heat_rows = await session.execute(
        text("""SELECT COALESCE(NULLIF(q.topics[1], ''), 'general') AS topic, r.regulator,
                       q.severity, o.coverage, count(*)
                FROM obligations o
                JOIN requirements q ON q.id = o.requirement_id
                JOIN regulations r ON r.id = q.regulation_id
                WHERE o.org_id = :org AND o.status <> 'not_applicable'
                  AND o.coverage IN ('missing', 'partial')
                GROUP BY 1, 2, 3, 4"""),
        p,
    )
    by_topic: dict[str, dict[str, int]] = {}
    by_regulator: dict[str, dict[str, int]] = {}
    for topic, regulator, sev, _coverage, n in heat_rows:
        for bucket, key in ((by_topic, topic), (by_regulator, regulator)):
            row = bucket.setdefault(key, {s: 0 for s in SEVERITIES})
            row[sev] = row.get(sev, 0) + n

    def matrix(bucket: dict[str, dict[str, int]]) -> list[dict]:
        rows = [{"key": k, **v, "total": sum(v.values())} for k, v in bucket.items()]
        return sorted(rows, key=lambda r: (-r.get("critical", 0), -r.get("high", 0), -r["total"]))

    today = clock.today()
    upcoming = [
        e
        for e in await events(session, org_id, today, today + timedelta(days=30))
        if e["status"] not in ("met", "done")
    ][:10]
    alerts = [
        {
            "id": str(r[0]),
            "kind": r[1],
            "severity": r[2],
            "title": r[3],
            "created_at": r[4].isoformat(),
        }
        for r in await session.execute(
            text(
                "SELECT id, kind, severity, title, created_at FROM alerts WHERE org_id = :org "
                "ORDER BY created_at DESC LIMIT 6"
            ),
            p,
        )
    ]
    filing_counts = (
        await session.execute(
            text("""SELECT count(*) FILTER (WHERE status = 'pending' AND due_on < :today),
                           count(*) FILTER (WHERE status = 'pending' AND due_on >= :today
                                            AND due_on <= CAST(:today AS date) + 30)
                    FROM filings WHERE org_id = :org"""),
            p,
        )
    ).one()
    approval_counts = (
        await session.execute(
            text("""SELECT count(*) FILTER (WHERE status = 'pending'),
                           count(*) FILTER (WHERE status = 'pending' AND level > 0)
                    FROM approval_requests WHERE org_id = :org"""),
            p,
        )
    ).one()
    return {
        "filings": {"overdue": filing_counts[0], "due_30_days": filing_counts[1]},
        "approvals": {"pending": approval_counts[0], "escalated": approval_counts[1]},
        "regulations_tracked": regs,
        "obligations": {
            "by_coverage": coverage,
            "by_status": status,
            "total": sum(status.values()),
        },
        "coverage_pct": coverage_pct(coverage),
        "tasks": {"open": tasks[0], "overdue": tasks[1], "done": tasks[2]},
        "heatmap": {
            "severities": SEVERITIES,
            "by_topic": matrix(by_topic),
            "by_regulator": matrix(by_regulator),
        },
        "upcoming": upcoming,
        "recent_alerts": alerts,
    }
