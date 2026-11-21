"""Public website endpoints: demo requests, spam controls, login rate limiting."""

from __future__ import annotations

from conftest import register
from sqlalchemy import func, select

from obligraph.db import session_scope
from obligraph.models import DemoRequest
from obligraph.seed import DEMO_EMAIL, DEMO_PASSWORD, seed_demo_org

FORM = {
    "name": "Asha Rao",
    "email": "Asha@lender.example",
    "company": "Lender Finance",
    "role": "Chief Compliance Officer",
    "entity_type": "nbfc",
    "message": "Interested in the SBR view.",
    "website": "",
}


async def count() -> int:
    async with session_scope() as session:
        return (await session.execute(select(func.count()).select_from(DemoRequest))).scalar_one()


async def test_demo_request_lifecycle(client):
    resp = await client.post("/api/public/demo-requests", json=FORM)
    assert resp.status_code == 201 and resp.json() == {"ok": True}
    # The same person resubmitting within a day is not stored twice.
    await client.post("/api/public/demo-requests", json=FORM)
    assert await count() == 1
    async with session_scope() as session:
        row = (await session.execute(select(DemoRequest))).scalar_one()
        assert row.email == "asha@lender.example" and len(row.ip_hash) == 64
        assert "." not in row.ip_hash  # the address itself is never stored

    admin = await register(client, "admin@obligraph.dev", "Obligraph Ops", ["nbfc"])
    listed = (await client.get("/api/admin/demo-requests", headers=admin["headers"])).json()
    assert [r["company"] for r in listed] == ["Lender Finance"] and listed[0]["status"] == "new"
    rid = listed[0]["id"]
    upd = await client.patch(
        f"/api/admin/demo-requests/{rid}", headers=admin["headers"], json={"status": "contacted"}
    )
    assert upd.json()["status"] == "contacted" and upd.json()["handled_at"]
    member = await register(client, "member@other.dev", "Other Co", ["nbfc"])
    assert (
        await client.get("/api/admin/demo-requests", headers=member["headers"])
    ).status_code == 403
    assert (
        await client.delete(f"/api/admin/demo-requests/{rid}", headers=admin["headers"])
    ).status_code == 204
    assert await count() == 0


async def test_demo_request_spam_controls(client):
    bot = {**FORM, "email": "bot@spam.example", "website": "http://spam.example"}
    assert (await client.post("/api/public/demo-requests", json=bot)).status_code == 201
    assert await count() == 0  # honeypot: accepted silently, never stored
    bad = await client.post("/api/public/demo-requests", json={**FORM, "email": "not-an-email"})
    assert bad.status_code == 422
    headers = {"X-Forwarded-For": "203.0.113.9"}
    codes = [
        (
            await client.post(
                "/api/public/demo-requests",
                headers=headers,
                json={**FORM, "email": f"p{i}@lender.example"},
            )
        ).status_code
        for i in range(6)
    ]
    assert codes == [201] * 5 + [429]  # 5 per hour per address
    other = await client.post(
        "/api/public/demo-requests",
        headers={"X-Forwarded-For": "198.51.100.7"},
        json={**FORM, "email": "fresh@lender.example"},
    )
    assert other.status_code == 201


async def test_login_is_rate_limited(client):
    await register(client, "user@ratelimit.dev", "RL Co", ["nbfc"])
    headers = {"X-Forwarded-For": "192.0.2.44"}
    codes = [
        (
            await client.post(
                "/api/auth/login",
                headers=headers,
                json={"email": "user@ratelimit.dev", "password": "wrong-password"},
            )
        ).status_code
        for _ in range(21)
    ]
    assert codes[:20] == [401] * 20 and codes[20] == 429


async def test_runtime_reports_whether_the_demo_login_works(client):
    # A deployment without SEED_DEMO has no demo account: the login page must not offer it.
    assert (await client.get("/api/meta/runtime")).json()["demo"] is False
    async with session_scope() as session:
        await seed_demo_org(session)
    assert (await client.get("/api/meta/runtime")).json()["demo"] is True
    login = await client.post(
        "/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}
    )
    assert login.status_code == 200
