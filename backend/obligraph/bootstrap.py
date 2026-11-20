"""Make a fresh deployment usable with nothing but a database URL.

Runs on API startup when AUTO_MIGRATE is on (the default on serverless hosts):
  1. apply database migrations,
  2. create LangGraph's checkpoint tables,
  3. seed reference data (regulator feeds, the sample returns catalogue),
  4. load or generate the token-signing secret if JWT_SECRET is not set,
  5. optionally load the demo workspace (SEED_DEMO=true, first start only).

Every step is idempotent, and a Postgres advisory lock stops two cold starts from
migrating at the same time.
"""

from __future__ import annotations

import asyncio
import logging
import secrets
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import create_async_engine

from obligraph.db import session_scope
from obligraph.dburl import async_url
from obligraph.models import InstanceConfig, Org
from obligraph.settings import DEV_JWT_SECRET, get_settings

log = logging.getLogger(__name__)
BACKEND_ROOT = Path(__file__).resolve().parent.parent
LOCK_ID = 7_260_011


def _alembic_config() -> Config:
    cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_ROOT / "migrations"))
    return cfg


async def migrate() -> None:
    # Alembic's env.py runs its own event loop, so it gets a thread of its own.
    await asyncio.to_thread(command.upgrade, _alembic_config(), "head")


async def _signing_secret() -> None:
    settings = get_settings()
    if settings.jwt_secret != DEV_JWT_SECRET:
        return  # set explicitly through JWT_SECRET
    async with session_scope() as session:
        await session.execute(
            insert(InstanceConfig)
            .values(key="jwt_secret", value=secrets.token_urlsafe(48))
            .on_conflict_do_nothing(index_elements=["key"])
        )
        stored = (
            await session.execute(
                select(InstanceConfig.value).where(InstanceConfig.key == "jwt_secret")
            )
        ).scalar_one()
    settings.jwt_secret = stored
    log.info("using the generated token-signing secret stored in the database")


async def _reference_data() -> None:
    from obligraph.compliance.filings import seed_catalogue
    from obligraph.seed import seed_sources

    async with session_scope() as session:
        await seed_sources(session)
        await seed_catalogue(session)


async def _demo_if_empty() -> None:
    from obligraph import seed

    async with session_scope() as session:
        orgs = (await session.execute(select(func.count()).select_from(Org))).scalar_one()
    if orgs == 0:
        log.info("SEED_DEMO is on and the database is empty: loading the demo workspace")
        await seed.run(demo=True, drain_now=not get_settings().is_serverless)


async def run() -> None:
    settings = get_settings()
    url, connect_args = async_url(settings.database_url_unpooled or settings.database_url)
    lock_engine = create_async_engine(url, connect_args=connect_args, pool_size=1)
    try:
        async with lock_engine.connect() as conn:
            await conn.execute(text("SELECT pg_advisory_lock(:id)"), {"id": LOCK_ID})
            await conn.commit()
            try:
                await migrate()
                from obligraph.compliance import approvals

                await approvals.init()
                await _reference_data()
                await _signing_secret()
                if settings.seed_demo:
                    await _demo_if_empty()
            finally:
                await conn.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": LOCK_ID})
                await conn.commit()
    finally:
        await lock_engine.dispose()
