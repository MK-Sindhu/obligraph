"""Seed data: monitored sources, and (optionally) a sample corpus with a demo org."""

from __future__ import annotations

import logging
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from obligraph import clock, vocab
from obligraph.compliance.filings import ensure_filings, seed_catalogue
from obligraph.compliance.obligations import sync_org
from obligraph.db import session_scope
from obligraph.ingest.pipeline import ingest_regulation, store_document
from obligraph.ingest.sources import DEFAULT_SOURCES
from obligraph.jobs import drain, enqueue
from obligraph.models import Filing, Membership, Org, Source, User
from obligraph.security import hash_password
from obligraph.textutil import parse_date

log = logging.getLogger(__name__)
FIXTURES = Path(__file__).parent / "fixtures"
DEMO_EMAIL = "demo@obligraph.dev"
DEMO_PASSWORD = "obligraph-demo"


def read_fixture(path: Path) -> tuple[dict, str]:
    raw = path.read_text(encoding="utf-8")
    meta: dict = {}
    if raw.startswith("---"):
        _, header, raw = raw.split("---", 2)
        for line in header.strip().splitlines():
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()
    return meta, raw.strip()


async def seed_sources(session: AsyncSession, enabled: bool = False) -> None:
    for key, name, regulator, url in DEFAULT_SOURCES:
        await session.execute(
            insert(Source)
            .values(
                id=uuid.uuid4(),
                key=key,
                name=name,
                regulator=regulator,
                url=url,
                enabled=enabled,
                kind="rss",
                items_seen=0,
            )
            .on_conflict_do_nothing(index_elements=["key"])
        )


async def seed_sample_corpus(session: AsyncSession) -> int:
    n = 0
    for path in sorted((FIXTURES / "regulations").glob("*.txt")):
        meta, text = read_fixture(path)
        await ingest_regulation(
            session,
            title=meta["title"],
            text=text,
            regulator=meta["regulator"],
            published_on=parse_date(meta.get("published_on")),
            source_key="sample",
            meta={"sample": True},
        )
        n += 1
    return n


async def seed_demo_org(session: AsyncSession) -> Org:
    user = (
        await session.execute(select(User).where(User.email == DEMO_EMAIL))
    ).scalar_one_or_none()
    if user is None:
        user = User(
            id=uuid.uuid4(),
            email=DEMO_EMAIL,
            name="Demo Compliance Lead",
            password_hash=hash_password(DEMO_PASSWORD),
            is_superuser=True,
        )
        session.add(user)
    org = (
        await session.execute(select(Org).where(Org.slug == "demo-finance"))
    ).scalar_one_or_none()
    changed = org is None
    if org is None:
        org = Org(
            id=uuid.uuid4(),
            name="Demo Finance Ltd",
            slug="demo-finance",
            entity_classes=["nbfc"],
            regulators=vocab.regulators_for(["nbfc"]),
            profile={
                "sbr_layer": "middle",
                "approval_sla_days": 2,
                "products": ["personal loans", "MSME loans"],
                "sample": True,
            },
        )
        session.add(org)
        await session.flush()
        session.add(Membership(user_id=user.id, org_id=org.id, role="owner"))
    await session.flush()
    changed |= bool(await sync_org(session, org))
    for path in sorted((FIXTURES / "policies").glob("*.md")):
        text = path.read_text(encoding="utf-8")
        title = text.splitlines()[0].lstrip("# ").strip()
        _doc, created = await store_document(
            session,
            kind="policy",
            org_id=org.id,
            title=title,
            text=text,
            filename=path.name,
            uploaded_by=user.id,
        )
        changed |= created
    if await ensure_filings(session, org):
        await _demo_filing_history(session, org)
    if changed:  # re-seeding an unchanged demo must not re-run (paid) assessments
        await enqueue(
            session, "assess_org", {"org_id": str(org.id)}, dedupe_key=f"assess_org:{org.id}"
        )
    return org


async def _demo_filing_history(session: AsyncSession, org: Org) -> None:
    """Make the demo's past filings look lived-in: most filed on time, one filed late,
    and the most recent past-due one left overdue."""
    from datetime import timedelta

    past = (
        (
            await session.execute(
                select(Filing)
                .where(
                    Filing.org_id == org.id,
                    Filing.status == "pending",
                    Filing.due_on < clock.today(),
                )
                .order_by(Filing.due_on)
            )
        )
        .scalars()
        .all()
    )
    for i, f in enumerate(past[:-1]):
        late = i == 1
        f.status = "filed"
        f.filed_on = f.due_on + timedelta(days=4) if late else f.due_on - timedelta(days=2)
        f.reference = f"ACK-{f.due_on:%Y%m}-{i + 101}"
        f.note = "Sample history created by the demo seed."


async def run(demo: bool, drain_now: bool = True) -> None:
    """``drain_now=False`` only queues the processing (serverless: it runs on later
    requests and the scheduled cron instead of during startup)."""
    async with session_scope() as session:
        await seed_sources(session)
        await seed_catalogue(session)
        if demo:
            n = await seed_sample_corpus(session)
            log.info("queued %s sample regulations", n)
    if demo:
        if drain_now:
            await drain()  # extract the corpus before the demo org maps against it
        async with session_scope() as session:
            await seed_demo_org(session)
        if drain_now:
            await drain()
