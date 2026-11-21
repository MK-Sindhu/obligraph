"""Serverless (Vercel) mode: URL handling, bootstrap, inline jobs, DB evidence, cron."""

from __future__ import annotations

import pytest
from conftest import register
from sqlalchemy import func, select, update

from obligraph import bootstrap, jobs
from obligraph.db import session_scope
from obligraph.dburl import async_url, is_pooled, libpq_url
from obligraph.models import Evidence, EvidenceBlob, InstanceConfig, Obligation, ReturnType, Source
from obligraph.seed import FIXTURES, seed_sample_corpus
from obligraph.settings import DEV_JWT_SECRET, get_settings


def test_platform_urls_are_normalised():
    neon = (
        "postgres://u:p@ep-x-123-pooler.ap-southeast-1.aws.neon.tech/neondb"
        "?sslmode=require&channel_binding=require"
    )
    url, args = async_url(neon)
    assert url == "postgresql+asyncpg://u:p@ep-x-123-pooler.ap-southeast-1.aws.neon.tech/neondb"
    assert args["ssl"] == "require" and args["statement_cache_size"] == 0
    assert callable(args["prepared_statement_name_func"]) and is_pooled(neon)
    assert libpq_url(neon).startswith("postgresql://u:p@ep-x-123-pooler")
    assert "sslmode=require" in libpq_url(neon)
    assert async_url("postgresql://a:b@localhost/db") == (
        "postgresql+asyncpg://a:b@localhost/db",
        {},
    )
    supa = "postgresql://a:b@db.x.supabase.co:6543/postgres?pgbouncer=true&sslmode=require"
    assert "pgbouncer" not in libpq_url(supa) and is_pooled(supa)
    # The form Vercel's Supabase integration sets as POSTGRES_URL.
    vercel_supa = (
        "postgres://postgres.abc:pw@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
        "?sslmode=require&supa=base-pooler.x"
    )
    url, args = async_url(vercel_supa)
    assert url.endswith(":6543/postgres") and "?" not in url
    assert args["ssl"] == "require" and args["statement_cache_size"] == 0
    assert libpq_url(vercel_supa).endswith("/postgres?sslmode=require")
    direct = "postgres://postgres.abc:pw@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
    assert is_pooled(direct)  # session-mode pooler: caching off is still safe


@pytest.fixture
def serverless(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "serverless", True)
    monkeypatch.setattr(s, "job_inline_budget_seconds", 60.0)
    return s


async def test_bootstrap_is_idempotent_and_generates_a_secret(monkeypatch, serverless):
    monkeypatch.setattr(serverless, "jwt_secret", DEV_JWT_SECRET)
    await bootstrap.run()
    first = serverless.jwt_secret
    assert first != DEV_JWT_SECRET and len(first) >= 48
    monkeypatch.setattr(serverless, "jwt_secret", DEV_JWT_SECRET)
    await bootstrap.run()  # a second cold start reuses the stored secret
    assert serverless.jwt_secret == first
    async with session_scope() as session:
        keys = set((await session.execute(select(InstanceConfig.key))).scalars())
        assert keys == {"jwt_secret", "bootstrap"}
        assert (await session.execute(select(func.count()).select_from(Source))).scalar_one() == 3
        assert (
            await session.execute(select(func.count()).select_from(ReturnType))
        ).scalar_one() == 11
    # Fast path: an already-bootstrapped database is not re-migrated or re-seeded.
    calls: list[str] = []

    async def no_migrate() -> None:
        calls.append("migrate")

    monkeypatch.setattr(bootstrap, "migrate", no_migrate)
    await bootstrap.run()
    assert calls == []


async def test_requests_run_their_own_jobs_and_store_evidence_in_db(client, serverless):
    a = await register(client, "lead@vercel.obligraph.dev", "Vercel Finance", ["nbfc"])
    async with session_scope() as session:
        await seed_sample_corpus(session)
    await jobs.drain()
    data = (FIXTURES / "policies" / "kyc_aml_policy.md").read_bytes()
    up = await client.post(
        "/api/policies", headers=a["headers"], files={"file": ("kyc.md", data, "text/markdown")}
    )
    assert up.status_code == 201
    # No worker and no explicit drain: the upload request assessed the obligations itself.
    async with session_scope() as session:
        assessed = (
            await session.execute(
                select(func.count())
                .select_from(Obligation)
                .where(Obligation.org_id == a["org_id"], Obligation.coverage != "unassessed")
            )
        ).scalar_one()
    assert assessed > 0
    assert (await client.get("/api/jobs/status", headers=a["headers"])).json() == {
        "pending": 0,
        "serverless": True,
    }

    ev = (
        await client.post(
            "/api/evidence",
            headers=a["headers"],
            files={"file": ("ack.pdf", b"%PDF-1.4 ack", "application/pdf")},
        )
    ).json()
    assert (
        await client.get(f"/api/evidence/{ev['id']}/download", headers=a["headers"])
    ).content == b"%PDF-1.4 ack"
    async with session_scope() as session:
        row = await session.get(Evidence, __import__("uuid").UUID(ev["id"]))
        assert row.storage_key.startswith("db:")
        await session.execute(
            update(EvidenceBlob).where(EvidenceBlob.evidence_id == row.id).values(data=b"forged")
        )
    assert (
        await client.get(f"/api/evidence/{ev['id']}/download", headers=a["headers"])
    ).status_code == 410

    big = b"x" * (4 * 1024 * 1024 + 1)
    too_big = await client.post(
        "/api/evidence",
        headers=a["headers"],
        files={"file": ("big.bin", big, "application/octet-stream")},
    )
    assert too_big.status_code == 422 and "4 MB" in too_big.text
    rt = (await client.get("/api/meta/runtime")).json()
    assert rt == {"serverless": True, "upload_limit_mb": 4, "ai_mode": "offline", "demo": False}


async def test_drain_endpoint_and_cron(client, monkeypatch, serverless):
    a = await register(client, "ops@cron.obligraph.dev", "Cron Finance", ["nbfc"])
    async with session_scope() as session:
        await seed_sample_corpus(session)  # queues extraction jobs (seeded outside a request)
    pending = (await client.get("/api/jobs/status", headers=a["headers"])).json()["pending"]
    assert pending == 10
    drained = (await client.post("/api/jobs/drain", headers=a["headers"])).json()
    assert drained["processed"] >= 10 and drained["pending"] == 0

    assert (await client.get("/api/internal/cron")).status_code == 401  # no secret configured
    monkeypatch.setattr(serverless, "cron_secret", "s3cret-value-for-tests")
    assert (
        await client.get("/api/internal/cron", headers={"Authorization": "Bearer wrong"})
    ).status_code == 401
    ok = await client.get(
        "/api/internal/cron", headers={"Authorization": "Bearer s3cret-value-for-tests"}
    )
    assert ok.status_code == 200 and ok.json()["pending"] == 0


async def test_admin_email_controls_platform_admin(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "admin_email", "owner@obligraph.dev")
    first = await register(client, "stranger@example.dev", "Stranger Co", ["nbfc"])
    assert first["body"]["user"]["is_superuser"] is False
    owner = await register(client, "Owner@obligraph.dev", "Obligraph", ["nbfc"])
    assert owner["body"]["user"]["is_superuser"] is True
