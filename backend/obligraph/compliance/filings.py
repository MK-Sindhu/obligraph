"""Returns and filings tracker.

A return type says *what* must be filed, by whom, how often and how many days after the
period ends. Filings are its per-period instances for one org. Periods follow the
Indian financial year: half-years are Apr-Sep and Oct-Mar, years are Apr-Mar.

The built-in catalogue is a SAMPLE: names, frequencies and due days are illustrative
and must be checked against the regulator's current directions. Orgs add their own
return types alongside it.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from obligraph import vocab
from obligraph.compliance.calendar import add_months
from obligraph.compliance.obligations import org_layer, org_regulators
from obligraph.models import Filing, Org, ReturnType

PERIOD_MONTHS = {"monthly": 1, "quarterly": 3, "half_yearly": 6, "annual": 12}
WINDOW_BACK_DAYS = 120
WINDOW_AHEAD_DAYS = 120

_NOTE = "Sample entry: verify the form, frequency and due date against current directions."
SAMPLE_CATALOGUE = [
    ("NBFC-QFP", "Quarterly financial position return", "RBI", ["nbfc"], [], "quarterly", 15),
    (
        "NBFC-MSL",
        "Monthly structural liquidity return",
        "RBI",
        ["nbfc"],
        ["middle", "upper", "top"],
        "monthly",
        10,
    ),
    (
        "NBFC-HIRS",
        "Half-yearly interest rate sensitivity return",
        "RBI",
        ["nbfc"],
        ["middle", "upper", "top"],
        "half_yearly",
        30,
    ),
    ("NBFC-SAC", "Annual statutory auditor's certificate", "RBI", ["nbfc"], [], "annual", 60),
    (
        "NBFC-PBC",
        "Annual principal business criteria certificate",
        "RBI",
        ["nbfc"],
        ["base"],
        "annual",
        30,
    ),
    ("NBFC-QCP", "Quarterly capital plan", "RBI", ["nbfc"], ["top"], "quarterly", 30),
    (
        "BANK-MLR",
        "Monthly liquidity return",
        "RBI",
        ["commercial_bank", "small_finance_bank"],
        [],
        "monthly",
        15,
    ),
    (
        "PA-QAR",
        "Quarterly payment aggregator activity report",
        "RBI",
        ["payment_aggregator"],
        [],
        "quarterly",
        15,
    ),
    (
        "FIU-CTR",
        "Monthly cash transaction report",
        "FIU-IND",
        ["commercial_bank", "nbfc", "payment_aggregator"],
        [],
        "monthly",
        15,
    ),
    ("AIF-QAR", "Quarterly AIF activity report", "SEBI", ["aif"], [], "quarterly", 15),
    ("CYB-AUD", "Annual cyber security audit report", "CERT-In", [], [], "annual", 90),
]


async def seed_catalogue(session: AsyncSession) -> None:
    for code, name, regulator, classes, layers, freq, due in SAMPLE_CATALOGUE:
        await session.execute(
            insert(ReturnType)
            .values(
                id=uuid.uuid4(),
                org_id=None,
                code=code,
                name=name,
                regulator=regulator,
                entity_classes=classes,
                layers=layers,
                frequency=freq,
                due_days=due,
                description=_NOTE,
                sample=True,
                active=True,
            )
            .on_conflict_do_nothing(constraint="uq_return_types_org_code")
        )


def return_applies(rt: ReturnType, org: Org) -> bool:
    if rt.org_id is not None:
        return rt.org_id == org.id
    if rt.entity_classes:
        if not set(rt.entity_classes) & set(org.entity_classes):
            return False
    elif rt.regulator not in vocab.UNIVERSAL_REGULATORS and rt.regulator not in org_regulators(org):
        return False
    if rt.layers and set(org.entity_classes) & vocab.NBFC_CLASSES:
        layer = org_layer(org)
        if layer and layer not in rt.layers:
            return False
    return True


def period_containing(d: date, frequency: str) -> tuple[date, date]:
    months = PERIOD_MONTHS[frequency]
    if frequency == "monthly":
        start = d.replace(day=1)
    elif frequency == "quarterly":
        start = date(d.year, ((d.month - 1) // 3) * 3 + 1, 1)
    else:  # half-yearly and annual periods start in April (Indian financial year)
        fy_start = date(d.year if d.month >= 4 else d.year - 1, 4, 1)
        start = fy_start
        if frequency == "half_yearly" and add_months(fy_start, 6) <= d:
            start = add_months(fy_start, 6)
    return start, add_months(start, months) - timedelta(days=1)


def periods_due_between(rt: ReturnType, lo: date, hi: date) -> list[tuple[date, date, date]]:
    """(period_start, period_end, due_on) for every period whose due date is in [lo, hi]."""
    out = []
    start, end = period_containing(lo - timedelta(days=rt.due_days + 400), rt.frequency)
    months = PERIOD_MONTHS[rt.frequency]
    while True:
        due = end + timedelta(days=rt.due_days)
        if due > hi:
            break
        if due >= lo:
            out.append((start, end, due))
        start = add_months(start, months)
        end = add_months(start, months) - timedelta(days=1)
    return out


async def applicable_types(session: AsyncSession, org: Org) -> list[ReturnType]:
    rows = (
        (
            await session.execute(
                select(ReturnType).where(
                    ReturnType.active, or_(ReturnType.org_id.is_(None), ReturnType.org_id == org.id)
                )
            )
        )
        .scalars()
        .all()
    )
    return [rt for rt in rows if return_applies(rt, org)]


async def ensure_filings(session: AsyncSession, org: Org, today: date | None = None) -> int:
    """Create the filing rows due in the rolling window (idempotent)."""
    today = today or date.today()
    lo, hi = today - timedelta(days=WINDOW_BACK_DAYS), today + timedelta(days=WINDOW_AHEAD_DAYS)
    n = 0
    for rt in await applicable_types(session, org):
        for start, end, due in periods_due_between(rt, lo, hi):
            res = await session.execute(
                insert(Filing)
                .values(
                    id=uuid.uuid4(),
                    org_id=org.id,
                    return_type_id=rt.id,
                    period_start=start,
                    period_end=end,
                    due_on=due,
                    status="pending",
                )
                .on_conflict_do_nothing(constraint="uq_filings_period")
            )
            n += res.rowcount or 0
    return n


def display_status(f: Filing, today: date | None = None) -> str:
    today = today or date.today()
    if f.status == "filed":
        return "late" if f.filed_on and f.filed_on > f.due_on else "filed"
    if f.status == "waived":
        return "waived"
    return "overdue" if f.due_on < today else "pending"
