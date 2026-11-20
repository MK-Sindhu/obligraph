"""Board / CCO report pack: a dated, printable summary of the compliance position.

Everything is computed from live tables, except the coverage trend, which reads the
daily ``coverage_snapshots`` written by the worker's housekeeping job. The narrative
is assembled from the numbers, so it never states anything the data does not show.
"""

from __future__ import annotations

import html
import uuid
from collections import Counter, defaultdict
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from obligraph import vocab
from obligraph.compliance import packs
from obligraph.compliance.dashboard import coverage_pct
from obligraph.compliance.filings import display_status
from obligraph.models import (
    ApprovalRequest,
    CoverageSnapshot,
    Filing,
    Obligation,
    Org,
    Regulation,
    Requirement,
    ReturnType,
    Task,
    User,
)

AGE_BUCKETS = [
    (0, 30, "0-30 days"),
    (31, 60, "31-60 days"),
    (61, 90, "61-90 days"),
    (91, 10_000, "Over 90 days"),
]


async def snapshot(session: AsyncSession, org_id: uuid.UUID, day: date | None = None) -> None:
    day = day or date.today()
    counts = dict(
        (
            await session.execute(
                select(Obligation.coverage, func.count())
                .where(Obligation.org_id == org_id, Obligation.status != "not_applicable")
                .group_by(Obligation.coverage)
            )
        ).all()
    )
    open_tasks, overdue = (
        await session.execute(
            text(
                "SELECT count(*) FILTER (WHERE status <> 'done'), "
                "count(*) FILTER (WHERE status <> 'done' AND due_on < current_date) "
                "FROM tasks WHERE org_id = :org"
            ),
            {"org": org_id},
        )
    ).one()
    values = {
        "covered": counts.get("covered", 0),
        "partial": counts.get("partial", 0),
        "missing": counts.get("missing", 0),
        "unassessed": counts.get("unassessed", 0),
        "open_tasks": open_tasks,
        "overdue_tasks": overdue,
        "coverage_pct": coverage_pct(counts),
    }
    await session.execute(
        insert(CoverageSnapshot)
        .values(org_id=org_id, day=day, **values)
        .on_conflict_do_update(index_elements=["org_id", "day"], set_=values)
    )


def default_period(today: date | None = None) -> tuple[date, date]:
    today = today or date.today()
    start = date(today.year, ((today.month - 1) // 3) * 3 + 1, 1)
    return start, today


def _bucket(days: int) -> str:
    return next(label for lo, hi, label in AGE_BUCKETS if lo <= days <= hi)


async def build(session: AsyncSession, org: Org, start: date, end: date) -> dict:
    await snapshot(session, org.id)
    today = date.today()
    rows = (
        await session.execute(
            select(Obligation, Requirement, Regulation)
            .join(Requirement, Requirement.id == Obligation.requirement_id)
            .join(Regulation, Regulation.id == Requirement.regulation_id)
            .where(Obligation.org_id == org.id)
        )
    ).all()
    active = [r for r in rows if r[0].status != "not_applicable"]
    counts = Counter(o.coverage for o, _q, _r in active)

    def rollup(key) -> list[dict]:
        groups: dict[str, Counter] = defaultdict(Counter)
        for o, q, r in active:
            groups[key(q, r)][o.coverage] += 1
        return sorted(
            (
                {"key": k, **dict(c), "total": sum(c.values()), "coverage_pct": coverage_pct(c)}
                for k, c in groups.items()
            ),
            key=lambda x: x["coverage_pct"] if x["coverage_pct"] is not None else 101,
        )

    gaps = [(o, q, r) for o, q, r in active if o.coverage in ("missing", "partial")]
    aging = {label: Counter() for _lo, _hi, label in AGE_BUCKETS}
    for o, q, _r in gaps:
        aging[_bucket((today - o.created_at.date()).days)][q.severity] += 1
    critical_gaps = [
        {
            "requirement": q.text,
            "severity": q.severity,
            "coverage": o.coverage,
            "regulation": r.title,
            "ref_no": r.ref_no,
            "age_days": (today - o.created_at.date()).days,
        }
        for o, q, r in sorted(gaps, key=lambda x: (x[1].severity != "critical", x[0].created_at))
        if q.severity in ("critical", "high")
    ][:10]

    new_regs: dict[uuid.UUID, dict] = {}
    for o, _q, r in rows:
        if r.issued_on and start <= r.issued_on <= end:
            item = new_regs.setdefault(
                r.id,
                {
                    "title": r.title,
                    "ref_no": r.ref_no,
                    "regulator": r.regulator,
                    "status": r.status,
                    "issued_on": r.issued_on.isoformat(),
                    "obligations": 0,
                    "open_gaps": 0,
                },
            )
            item["obligations"] += 1
            item["open_gaps"] += (
                o.coverage in ("missing", "partial") and o.status != "not_applicable"
            )
    superseded = sorted({r.title for o, q, r in rows if o.retired_reason == "superseded"})

    overdue_tasks = (
        (
            await session.execute(
                select(Task)
                .where(Task.org_id == org.id, Task.status != "done", Task.due_on < today)
                .order_by(Task.due_on)
                .limit(10)
            )
        )
        .scalars()
        .all()
    )

    approvals = (
        (await session.execute(select(ApprovalRequest).where(ApprovalRequest.org_id == org.id)))
        .scalars()
        .all()
    )
    decided = [a for a in approvals if a.decided_at and start <= a.decided_at.date() <= end]

    filings = (
        await session.execute(
            select(Filing, ReturnType.name)
            .join(ReturnType, ReturnType.id == Filing.return_type_id)
            .where(Filing.org_id == org.id, Filing.due_on >= start, Filing.due_on <= end)
        )
    ).all()
    filing_status = Counter(display_status(f, today) for f, _n in filings)
    missed = [
        {"name": n, "due_on": f.due_on.isoformat(), "status": display_status(f, today)}
        for f, n in filings
        if display_status(f, today) in ("overdue", "late")
    ]

    owners = Counter(o.owner_id for o, _q, _r in active if o.status in ("open", "in_progress"))
    names = {
        u.id: u.name
        for u in (
            await session.execute(select(User).where(User.id.in_([k for k in owners if k])))
        ).scalars()
    }
    open_total = sum(owners.values())
    ownership = sorted(
        (
            {
                "owner": names.get(k, "Unassigned") if k else "Unassigned",
                "open": n,
                "share_pct": round(100 * n / open_total, 1) if open_total else 0,
            }
            for k, n in owners.items()
        ),
        key=lambda x: -x["open"],
    )

    trend = [
        {
            "day": s.day.isoformat(),
            "coverage_pct": s.coverage_pct,
            "missing": s.missing,
            "partial": s.partial,
            "covered": s.covered,
        }
        for s in (
            await session.execute(
                select(CoverageSnapshot)
                .where(
                    CoverageSnapshot.org_id == org.id,
                    CoverageSnapshot.day >= end - timedelta(days=365),
                    CoverageSnapshot.day <= end,
                )
                .order_by(CoverageSnapshot.day)
            )
        ).scalars()
    ]

    report = {
        "org": {
            "name": org.name,
            "entity_classes": org.entity_classes,
            "sbr_layer": (org.profile or {}).get("sbr_layer"),
        },
        "period": {
            "start": start.isoformat(),
            "end": end.isoformat(),
            "label": f"{start:%d %b %Y} to {end:%d %b %Y}",
        },
        "generated_at": datetime.now(UTC).isoformat(),
        "headline": {
            "coverage_pct": coverage_pct(counts),
            "obligations": len(active),
            "by_coverage": dict(counts),
            "open_gaps": len(gaps),
            "critical_high_gaps": sum(q.severity in ("critical", "high") for _o, q, _r in gaps),
            "overdue_tasks": len(overdue_tasks),
            "pending_approvals": sum(a.status == "pending" for a in approvals),
            "escalated_approvals": sum(a.status == "pending" and a.level > 0 for a in approvals),
            "filings": dict(filing_status),
        },
        "trend": trend,
        "by_regulator": rollup(lambda q, r: r.regulator),
        "by_topic": rollup(
            lambda q, r: vocab.TOPICS.get(q.topics[0], (q.topics[0],))[0] if q.topics else "General"
        ),
        "gap_aging": [{"bucket": label, **dict(aging[label])} for _l, _h, label in AGE_BUCKETS],
        "critical_gaps": critical_gaps,
        "new_regulations": sorted(new_regs.values(), key=lambda x: x["issued_on"]),
        "superseded": superseded,
        "overdue_tasks": [
            {"title": t.title, "due_on": t.due_on.isoformat(), "priority": t.priority}
            for t in overdue_tasks
        ],
        "approvals": {
            "approved": sum(a.status == "approved" for a in decided),
            "rejected": sum(a.status == "rejected" for a in decided),
            "pending": sum(a.status == "pending" for a in approvals),
        },
        "filings_missed": missed,
        "ownership": ownership,
        "packs": [
            {k: p[k] for k in ("name", "obligations", "readiness_pct")}
            for p in await packs.summaries(session, org)
        ],
    }
    report["narrative"] = narrative(report)
    return report


def _pct(v) -> str:
    return "not yet measured" if v is None else f"{v:.0f}%"


def narrative(r: dict) -> list[str]:
    h = r["headline"]
    paras = [
        f"Across {h['obligations']} applicable obligations, policy coverage stands at "
        f"{_pct(h['coverage_pct'])}. There are {h['open_gaps']} open gaps, "
        f"{h['critical_high_gaps']} of them rated critical or high."
    ]
    trend = [t for t in r["trend"] if t["coverage_pct"] is not None]
    if len(trend) >= 2:
        delta = trend[-1]["coverage_pct"] - trend[0]["coverage_pct"]
        direction = "improved" if delta > 0 else "declined" if delta < 0 else "held steady"
        paras.append(
            f"Coverage has {direction} by {abs(delta):.1f} points since {trend[0]['day']}."
        )
    if r["new_regulations"]:
        n = len(r["new_regulations"])
        gaps = sum(x["open_gaps"] for x in r["new_regulations"])
        paras.append(
            f"{n} new instrument{'s' if n != 1 else ''} issued in the period added "
            f"obligations for the organisation; {gaps} of those obligations remain open "
            "gaps."
        )
    worst = next((x for x in r["by_regulator"] if x["coverage_pct"] is not None), None)
    if worst:
        paras.append(
            f"The weakest area by regulator is {worst['key']} at "
            f"{_pct(worst['coverage_pct'])} coverage."
        )
    old = sum(sum(v for k, v in b.items() if k != "bucket") for b in r["gap_aging"][2:])
    if old:
        paras.append(f"{old} gaps have been open for more than 60 days and need an owner decision.")
    if h["overdue_tasks"] or h["escalated_approvals"]:
        paras.append(
            f"{h['overdue_tasks']} remediation tasks are overdue and "
            f"{h['escalated_approvals']} approvals have breached their SLA."
        )
    missed = r["filings_missed"]
    if missed:
        paras.append(f"{len(missed)} statutory filings in the period were missed or filed late.")
    top = r["ownership"][0] if r["ownership"] else None
    if top and top["owner"] != "Unassigned" and top["share_pct"] >= 50:
        paras.append(
            f"{top['owner']} owns {top['share_pct']:.0f}% of open obligations, a key-"
            "person concentration the Board may wish to address."
        )
    unassigned = next((x for x in r["ownership"] if x["owner"] == "Unassigned"), None)
    if unassigned and unassigned["open"]:
        paras.append(f"{unassigned['open']} open obligations have no named owner.")
    return paras


# --------------------------------------------------------------------------- HTML


def _sparkline(points: list[float], w: int = 520, h: int = 90) -> str:
    if len(points) < 2:
        return "<p class='muted'>Trend appears after two or more daily snapshots.</p>"
    lo, hi = min(points + [0]), max(points + [100])
    step = w / (len(points) - 1)
    xy = [(i * step, h - (p - lo) / (hi - lo or 1) * h) for i, p in enumerate(points)]
    path = " ".join(f"{'M' if i == 0 else 'L'}{x:.1f},{y:.1f}" for i, (x, y) in enumerate(xy))
    return (
        f"<svg viewBox='0 0 {w} {h}' class='spark' role='img' aria-label='Coverage trend'>"
        f"<path d='{path}' fill='none' stroke='#2b5bff' stroke-width='2.5'/></svg>"
    )


def to_html(r: dict) -> str:
    e = html.escape
    h = r["headline"]

    def table(rows: list[dict], cols: list[tuple[str, str]]) -> str:
        if not rows:
            return "<p class='muted'>None.</p>"
        head = "".join(f"<th>{e(label)}</th>" for _k, label in cols)
        body = "".join(
            "<tr>"
            + "".join(
                f"<td>{e(str(row.get(k, '') if row.get(k) is not None else '-'))}</td>"
                for k, _l in cols
            )
            + "</tr>"
            for row in rows
        )
        return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"

    kpis = [
        ("Policy coverage", _pct(h["coverage_pct"])),
        ("Open gaps", h["open_gaps"]),
        ("Critical / high gaps", h["critical_high_gaps"]),
        ("Overdue tasks", h["overdue_tasks"]),
        ("Pending approvals", h["pending_approvals"]),
    ]
    trend_pts = [t["coverage_pct"] for t in r["trend"] if t["coverage_pct"] is not None]
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Board compliance pack · {e(r["org"]["name"])}</title>
<style>
 body{{font:14px/1.55 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#2e3542;
   background:#e9edf3;margin:0}}
 main{{max-width:900px;margin:24px auto;background:#f7f9fc;border-radius:28px;padding:40px 48px;
   box-shadow:10px 12px 28px rgba(160,174,196,.45),-8px -8px 20px #fff}}
 h1{{font-size:26px;margin:0}} h2{{font-size:17px;margin:32px 0 10px;color:#1f2a44}}
 .muted{{color:#6b7385}} .kpis{{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;
   margin-top:22px}}
 .kpi{{background:#fff;border-radius:18px;padding:14px 16px;box-shadow:0 4px 14px
   rgba(160,174,196,.3)}} .kpi b{{display:block;font-size:24px;color:#2348f5}}
 table{{width:100%;border-collapse:collapse;font-size:13px}} th,td{{text-align:left;
   padding:7px 8px;border-bottom:1px solid #dde3ec}} th{{color:#6b7385;font-weight:600}}
 .spark{{width:100%;height:90px}} .narr p{{margin:0 0 8px}}
 @media print{{body{{background:#fff}} main{{box-shadow:none;margin:0;max-width:none}}
   h2{{break-after:avoid}} table{{break-inside:avoid}}}}
</style></head><body><main>
<p class="muted">Board compliance pack · {e(r["period"]["label"])}</p>
<h1>{e(r["org"]["name"])}</h1>
<p class="muted">Generated {e(r["generated_at"][:16].replace("T", " "))} UTC by Obligraph</p>
<div class="kpis">{"".join(f"<div class='kpi'>{e(k)}<b>{e(str(v))}</b></div>" for k, v in kpis)}</div>
<h2>Executive summary</h2><div class="narr">{"".join(f"<p>{e(p)}</p>" for p in r["narrative"])}</div>
<h2>Coverage trend</h2>{_sparkline(trend_pts)}
<h2>Coverage by regulator</h2>{table(r["by_regulator"], [("key", "Regulator"), ("covered", "Covered"), ("partial", "Partial"), ("missing", "Missing"), ("coverage_pct", "Coverage %")])}
<h2>Coverage by topic</h2>{table(r["by_topic"], [("key", "Topic"), ("covered", "Covered"), ("partial", "Partial"), ("missing", "Missing"), ("coverage_pct", "Coverage %")])}
<h2>Gap ageing</h2>{table(r["gap_aging"], [("bucket", "Open for"), ("critical", "Critical"), ("high", "High"), ("medium", "Medium"), ("low", "Low")])}
<h2>Critical and high gaps</h2>{table(r["critical_gaps"], [("requirement", "Requirement"), ("severity", "Severity"), ("coverage", "Coverage"), ("ref_no", "Instrument"), ("age_days", "Age (days)")])}
<h2>New instruments in the period</h2>{table(r["new_regulations"], [("title", "Instrument"), ("regulator", "Regulator"), ("issued_on", "Issued"), ("obligations", "Obligations"), ("open_gaps", "Open gaps")])}
<h2>Statutory filings</h2>{table(r["filings_missed"], [("name", "Return"), ("due_on", "Due"), ("status", "Status")])}
<h2>Overdue remediation</h2>{table(r["overdue_tasks"], [("title", "Task"), ("due_on", "Due"), ("priority", "Priority")])}
<h2>Ownership</h2>{table(r["ownership"], [("owner", "Owner"), ("open", "Open obligations"), ("share_pct", "Share %")])}
<h2>Readiness packs</h2>{table(r["packs"], [("name", "Pack"), ("obligations", "Obligations"), ("readiness_pct", "Readiness %")])}
</main></body></html>"""
