"""Test harness: a real Postgres (pgvector) database, migrated from scratch per session.

Point TEST_DATABASE_URL elsewhere if needed; it defaults to the compose service's
``obligraph_test`` database. Every test starts from empty tables.
"""

from __future__ import annotations

import os

os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://obligraph:obligraph@localhost:5442/obligraph_test",
)
os.environ["AI_MODE"] = "offline"
os.environ["RUN_WORKER_IN_API"] = "false"
os.environ["EMBEDDINGS_PROVIDER"] = "none"
os.environ["CRAWL_ENABLED"] = "false"

from pathlib import Path  # noqa: E402

import httpx  # noqa: E402
import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine  # noqa: E402

from obligraph.db import dispose, session_scope  # noqa: E402
from obligraph.settings import get_settings  # noqa: E402

BACKEND = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session", autouse=True)
async def migrated():
    url = get_settings().database_url
    engine = create_async_engine(url)
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
    await engine.dispose()

    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "migrations"))
    cfg.attributes["database_url"] = url

    import asyncio

    # env.py runs its own event loop, so run the upgrade in a worker thread.
    await asyncio.to_thread(command.upgrade, cfg, "head")
    from obligraph.compliance import approvals

    await approvals.init()  # LangGraph checkpoint tables, outside any transaction
    yield
    from obligraph.compliance import approvals

    await approvals.shutdown()
    await dispose()


TABLES = (
    "chat_messages, conversations, tasks, alerts, obligations, requirements, regulations, "
    "chunks, documents, graph_edges, graph_nodes, memberships, orgs, users, audit_events, "
    "llm_calls, jobs, sources"
)


@pytest.fixture(autouse=True)
async def clean(migrated):
    async with session_scope() as session:
        await session.execute(text(f"TRUNCATE {TABLES} CASCADE"))
    yield


@pytest.fixture
async def client():
    from obligraph.api.app import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def register(client: httpx.AsyncClient, email: str, org: str, classes: list[str]) -> dict:
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "correct-horse-battery",
            "name": email.split("@")[0],
            "org_name": org,
            "entity_classes": classes,
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    return {
        "token": body["token"],
        "org_id": body["memberships"][0]["org"]["id"],
        "user_id": body["user"]["id"],
        "headers": {
            "Authorization": f"Bearer {body['token']}",
            "X-Org-Id": body["memberships"][0]["org"]["id"],
        },
        "body": body,
    }
