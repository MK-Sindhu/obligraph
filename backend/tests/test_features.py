"""Approvals (LangGraph), evidence, exports, SBR, packs, filings, board pack, SSO."""

from __future__ import annotations

import io
import json
import time
import uuid
import zipfile
from datetime import UTC, date, datetime, timedelta
from urllib.parse import parse_qs, urlparse

import httpx
import jwt
import pytest
from conftest import register
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy import select, update

from obligraph import jobs, sso
from obligraph.compliance import approvals, housekeeping
from obligraph.compliance import evidence as store
from obligraph.compliance.filings import period_containing
from obligraph.db import session_scope
from obligraph.models import ApprovalRequest, Evidence, Task
from obligraph.seed import FIXTURES, seed_sample_corpus
from obligraph.settings import get_settings


async def corpus() -> None:
    async with session_scope() as session:
        await seed_sample_corpus(session)
    await jobs.drain()


async def upload_policy(client, headers, name):
    data = (FIXTURES / "policies" / name).read_bytes()
    resp = await client.post(
        "/api/policies", headers=headers, files={"file": (name, data, "text/markdown")}
    )
    assert resp.status_code == 201, resp.text


async def add_member(client, owner, email, role):
    resp = await client.post(
        "/api/org/members",
        headers=owner["headers"],
        json={
            "email": email,
            "name": email.split("@")[0],
            "role": role,
            "password": "member-password-1",
        },
    )
    assert resp.status_code == 201, resp.text
    login = await client.post(
        "/api/auth/login", json={"email": email, "password": "member-password-1"}
    )
    return {"Authorization": f"Bearer {login.json()['token']}", "X-Org-Id": owner["org_id"]}


async def force_overdue(approval_id: str) -> None:
    async with session_scope() as session:
        await session.execute(
            update(ApprovalRequest)
            .where(ApprovalRequest.id == uuid.UUID(approval_id))
            .values(due_at=datetime.now(UTC) - timedelta(hours=1))
        )


async def run_housekeeping() -> dict:
    async with session_scope() as session:
        return await housekeeping.run(session)


async def test_maker_checker_lifecycle_with_escalation(client):
    owner = await register(client, "owner@alpha.obligraph.dev", "Alpha Finance", ["nbfc"])
    checker = await add_member(client, owner, "checker@alpha.obligraph.dev", "admin")
    maker = await add_member(client, owner, "maker@alpha.obligraph.dev", "member")
    await corpus()
    await upload_policy(client, owner["headers"], "information_security_policy.md")
    await jobs.drain()

    tasks = (await client.get("/api/tasks", headers=maker)).json()
    task = next(t for t in tasks if t["requires_approval"])

    ev = await client.post(
        "/api/evidence",
        headers=maker,
        data={"task_id": task["id"], "note": "Updated incident runbook"},
        files={"file": ("runbook.txt", b"Report within 6 hours.", "text/plain")},
    )
    assert ev.status_code == 201
    ev_id = ev.json()["id"]

    sub = await client.post(
        f"/api/tasks/{task['id']}/submit",
        headers=maker,
        json={"note": "Runbook updated", "evidence_ids": [ev_id]},
    )
    assert sub.status_code == 201, sub.text
    appr = sub.json()
    assert appr["status"] == "pending" and appr["level"] == 0 and appr["evidence"][0]["id"] == ev_id
    detail = (await client.get(f"/api/approvals/{appr['id']}", headers=owner["headers"])).json()
    assert detail["workflow"]["next"] == ["wait_for_checker"]  # LangGraph thread is paused
    moved = await client.patch(f"/api/tasks/{task['id']}", headers=maker, json={"status": "todo"})
    assert moved.status_code == 409  # cannot move a task out from under a pending review

    # The maker cannot check their own work; a rejection needs a reason.
    assert (
        await client.post(f"/api/approvals/{appr['id']}/approve", headers=maker, json={})
    ).status_code == 403
    assert (
        await client.post(
            f"/api/approvals/{appr['id']}/reject", headers=checker, json={"note": " "}
        )
    ).status_code == 422
    inbox = (await client.get("/api/approvals?inbox=true", headers=checker)).json()
    assert [a["id"] for a in inbox] == [appr["id"]]
    rejected = await client.post(
        f"/api/approvals/{appr['id']}/reject",
        headers=checker,
        json={"note": "Attach the board approval too."},
    )
    assert rejected.json()["status"] == "rejected"
    task_now = next(
        t for t in (await client.get("/api/tasks", headers=maker)).json() if t["id"] == task["id"]
    )
    assert task_now["status"] == "doing"

    # Resubmit; the SLA lapses twice, escalating to admins and then to the owner.
    appr2 = (
        await client.post(
            f"/api/tasks/{task['id']}/submit",
            headers=maker,
            json={"note": "Board approval attached", "evidence_ids": [ev_id]},
        )
    ).json()
    await force_overdue(appr2["id"])
    assert (await run_housekeeping())["escalated"] == 1
    await force_overdue(appr2["id"])
    await run_housekeeping()
    a2 = (await client.get(f"/api/approvals/{appr2['id']}", headers=owner["headers"])).json()
    assert a2["level"] == 2 and a2["required_role"] == "owner"
    assert (
        await client.post(f"/api/approvals/{appr2['id']}/approve", headers=checker, json={})
    ).status_code == 403
    done = await client.post(
        f"/api/approvals/{appr2['id']}/approve",
        headers=owner["headers"],
        json={"note": "Approved by CCO"},
    )
    body = done.json()
    assert body["status"] == "approved" and body["checker"] == "owner"
    assert [h["event"] for h in body["history"]] == [
        "submitted",
        "escalated",
        "escalated",
        "approved",
    ]
    final = (await client.get(f"/api/approvals/{appr2['id']}", headers=owner["headers"])).json()
    assert final["workflow"]["next"] == []  # thread reached END

    task_now = next(
        t for t in (await client.get("/api/tasks", headers=maker)).json() if t["id"] == task["id"]
    )
    assert task_now["status"] == "done" and task_now["completed_at"]
    alerts = {a["kind"] for a in (await client.get("/api/alerts", headers=owner["headers"])).json()}
    assert {
        "approval_requested",
        "approval_escalated",
        "approval_rejected",
        "approval_approved",
    } <= alerts
    # Evidence behind an approved decision is locked.
    assert (
        await client.delete(f"/api/evidence/{ev_id}", headers=owner["headers"])
    ).status_code == 409
    dash = (await client.get("/api/dashboard", headers=owner["headers"])).json()
    assert dash["approvals"] == {"pending": 0, "escalated": 0}


async def test_evidence_integrity_isolation_and_exports(client):
    a = await register(client, "lead@alpha.obligraph.dev", "Alpha Finance", ["nbfc"])
    b = await register(client, "lead@beta.obligraph.dev", "Beta Fund", ["aif"])
    await corpus()
    await upload_policy(client, a["headers"], "kyc_aml_policy.md")
    await jobs.drain()
    ob = (await client.get("/api/obligations?limit=1", headers=a["headers"])).json()["items"][0]
    up = await client.post(
        "/api/evidence",
        headers=a["headers"],
        data={"obligation_id": ob["id"]},
        files={"file": ("board-minutes.pdf", b"%PDF-1.4 minutes", "application/pdf")},
    )
    ev = up.json()
    got = await client.get(f"/api/evidence/{ev['id']}/download", headers=a["headers"])
    assert got.content == b"%PDF-1.4 minutes" and got.headers["x-content-sha256"] == ev["sha256"]
    assert (
        await client.get(f"/api/evidence/{ev['id']}/download", headers=b["headers"])
    ).status_code == 404
    # Someone tampers with the stored file: downloads refuse to serve it.
    async with session_scope() as session:
        row = await session.get(Evidence, uuid.UUID(ev["id"]))
        store.path_for(row.storage_key).write_bytes(b"forged")
    assert (
        await client.get(f"/api/evidence/{ev['id']}/download", headers=a["headers"])
    ).status_code == 410
    async with session_scope() as session:
        row = await session.get(Evidence, uuid.UUID(ev["id"]))
        store.path_for(row.storage_key).write_bytes(b"%PDF-1.4 minutes")

    csv_text = (await client.get("/api/exports/obligations.csv", headers=a["headers"])).text
    assert csv_text.startswith("obligation_id,regulator,instrument") and csv_text.count("\n") > 20
    pack = await client.get("/api/exports/audit-pack.zip", headers=a["headers"])
    zf = zipfile.ZipFile(io.BytesIO(pack.content))
    names = zf.namelist()
    assert {
        "obligations.csv",
        "tasks.csv",
        "approvals.csv",
        "evidence.csv",
        "filings.csv",
        "activity.csv",
        "policies.csv",
        "manifest.json",
        "README.txt",
    } <= set(names)
    manifest = json.loads(zf.read("manifest.json"))
    arc = f"evidence/{ev['id']}_board-minutes.pdf"
    assert manifest["files"][arc]["sha256"] == ev["sha256"]
    viewer = await add_member(client, a, "viewer@alpha.obligraph.dev", "viewer")
    assert (await client.get("/api/exports/audit-pack.zip", headers=viewer)).status_code == 403


async def test_sbr_layers_resync_and_view(client):
    a = await register(client, "cco@nbfc.obligraph.dev", "Layered Finance", ["nbfc"])
    await corpus()

    all_obs = (await client.get("/api/obligations?q=Layer&limit=50", headers=a["headers"])).json()
    assert all_obs["total"] == 9  # layer unknown: every layer's requirements apply (safe default)

    resp = await client.patch(
        "/api/org", headers=a["headers"], json={"profile": {"sbr_layer": "middle"}}
    )
    assert resp.status_code == 200 and resp.json()["profile"]["sbr_layer"] == "middle"
    active = (await client.get("/api/obligations?q=Layer&limit=50", headers=a["headers"])).json()
    assert all(
        "Middle Layer and above" in t or "All NBFCs" in t
        for t in (i["requirement"]["text"] for i in active["items"])
    )
    retired = (
        await client.get(
            "/api/obligations?include_retired=true&status=not_applicable&q=Layer",
            headers=a["headers"],
        )
    ).json()["items"]
    assert len(retired) == 5 and all(
        "your organisation is Middle Layer" in o["rationale"] for o in retired
    )

    view = (await client.get("/api/sbr?target=upper", headers=a["headers"])).json()
    assert view["current_layer"] == "middle" and view["target_layer"] == "upper"
    added = {i["requirement"][:35] for i in view["added_at_target"]}
    assert len(added) == 3 and any(
        "Common Equity Tier 1" in x or "Upper Layer shall" in x for x in added
    )
    counts = {x["key"]: x["requirements"] for x in view["layers"]}
    assert counts["top"] > counts["base"]

    assert (
        await client.patch(
            "/api/org", headers=a["headers"], json={"profile": {"sbr_layer": "huge"}}
        )
    ).status_code == 422
    await client.patch("/api/org", headers=a["headers"], json={"profile": {"sbr_layer": "base"}})
    active = (await client.get("/api/obligations?q=Layer&limit=50", headers=a["headers"])).json()
    assert {i["requirement"]["text"][:28] for i in active["items"]} == {
        "All NBFCs shall put in place",
        "NBFCs in the Base Layer shal",
    }


async def test_readiness_packs(client):
    a = await register(client, "dpo@alpha.obligraph.dev", "Alpha Finance", ["nbfc"])
    await corpus()
    packs = {p["key"]: p for p in (await client.get("/api/packs", headers=a["headers"])).json()}
    assert packs["dpdp"]["obligations"] == 8 and packs["dpdp"]["readiness_pct"] is None
    assert packs["cert_in"]["obligations"] >= 5
    await upload_policy(client, a["headers"], "privacy_policy.md")
    await jobs.drain()
    dpdp = (await client.get("/api/packs/dpdp", headers=a["headers"])).json()
    assert dpdp["readiness_pct"] is not None and 0 < dpdp["readiness_pct"] < 100
    breach = next(i for i in dpdp["items"] if "personal data breach, a Data" in i["requirement"])
    assert breach["coverage"] == "partial"  # policy says seven days, rule says 72 hours
    assert (await client.get("/api/packs/nope", headers=a["headers"])).status_code == 404


def test_indian_financial_year_periods():
    assert period_containing(date(2026, 11, 20), "quarterly") == (
        date(2026, 10, 1),
        date(2026, 12, 31),
    )
    assert period_containing(date(2026, 11, 20), "half_yearly") == (
        date(2026, 10, 1),
        date(2027, 3, 31),
    )
    assert period_containing(date(2026, 5, 2), "half_yearly") == (
        date(2026, 4, 1),
        date(2026, 9, 30),
    )
    assert period_containing(date(2027, 2, 1), "annual") == (date(2026, 4, 1), date(2027, 3, 31))
    assert period_containing(date(2026, 2, 14), "monthly") == (date(2026, 2, 1), date(2026, 2, 28))


async def test_filings_tracker(client):
    async with session_scope() as session:
        from obligraph.compliance.filings import seed_catalogue

        await seed_catalogue(session)
    a = await register(client, "ops@alpha.obligraph.dev", "Alpha Finance", ["nbfc"])
    await client.patch("/api/org", headers=a["headers"], json={"profile": {"sbr_layer": "middle"}})
    codes = {r["code"] for r in (await client.get("/api/returns", headers=a["headers"])).json()}
    assert {"NBFC-QFP", "NBFC-MSL", "NBFC-HIRS", "NBFC-SAC", "FIU-CTR", "CYB-AUD"} <= codes
    assert not codes & {"NBFC-PBC", "NBFC-QCP", "AIF-QAR", "PA-QAR"}

    filings = (await client.get("/api/filings", headers=a["headers"])).json()
    assert filings and {f["status"] for f in filings} <= {"pending", "overdue"}
    overdue = next(f for f in filings if f["status"] == "overdue")
    member = await add_member(client, a, "clerk@alpha.obligraph.dev", "member")
    ev = (
        await client.post(
            "/api/evidence",
            headers=member,
            files={"file": ("ack.pdf", b"%PDF ack", "application/pdf")},
        )
    ).json()
    filed = await client.post(
        f"/api/filings/{overdue['id']}/file",
        headers=member,
        json={
            "filed_on": date.today().isoformat(),
            "reference": "ACK-123",
            "evidence_id": ev["id"],
        },
    )
    assert filed.json()["status"] == "late" and filed.json()["evidence"][0]["id"] == ev["id"]
    assert (
        await client.post(
            f"/api/filings/{overdue['id']}/file",
            headers=member,
            json={"filed_on": date.today().isoformat(), "reference": "X"},
        )
    ).status_code == 409
    pending = next(f for f in filings if f["status"] == "pending")
    assert (
        await client.post(
            f"/api/filings/{pending['id']}/waive",
            headers=member,
            json={"note": "not applicable this period"},
        )
    ).status_code == 403
    waived = await client.post(
        f"/api/filings/{pending['id']}/waive",
        headers=a["headers"],
        json={"note": "No business in the period"},
    )
    assert waived.json()["status"] == "waived"

    custom = await client.post(
        "/api/returns",
        headers=a["headers"],
        json={
            "code": "INT-BRD",
            "name": "Board compliance certificate",
            "regulator": "RBI",
            "frequency": "quarterly",
            "due_days": 20,
        },
    )
    assert custom.status_code == 201 and custom.json()["custom"] is True
    cal = (
        await client.get(
            f"/api/calendar?start={date.today() - timedelta(days=60)}"
            f"&end={date.today() + timedelta(days=100)}",
            headers=a["headers"],
        )
    ).json()
    filing_events = [e for e in cal if e["kind"] == "filing"]
    assert filing_events and any(
        "Board compliance certificate" in e["title"] for e in filing_events
    )
    dash = (await client.get("/api/dashboard", headers=a["headers"])).json()
    assert dash["filings"]["overdue"] >= 0 and "due_30_days" in dash["filings"]


async def test_board_pack(client):
    a = await register(client, "cco@alpha.obligraph.dev", "Alpha Finance", ["nbfc"])
    await corpus()
    await upload_policy(client, a["headers"], "kyc_aml_policy.md")
    await jobs.drain()
    pack = (await client.get("/api/reports/board-pack", headers=a["headers"])).json()
    h = pack["headline"]
    assert h["obligations"] > 20 and h["open_gaps"] > 0 and 0 < h["coverage_pct"] < 100
    assert pack["narrative"][0].startswith(f"Across {h['obligations']} applicable obligations")
    assert pack["by_regulator"] and pack["gap_aging"][0]["bucket"] == "0-30 days"
    assert {p["name"] for p in pack["packs"]} >= {"DPDP readiness"}
    assert pack["ownership"][0]["owner"] == "Unassigned"
    page = await client.get("/api/reports/board-pack.html", headers=a["headers"])
    assert page.headers["content-type"].startswith("text/html")
    assert "Alpha Finance" in page.text and "Executive summary" in page.text
    bad = await client.get(
        "/api/reports/board-pack?start=2026-05-01&end=2026-01-01", headers=a["headers"]
    )
    assert bad.status_code == 422


async def test_overdue_task_alerts_once_per_day(client):
    a = await register(client, "ops@gamma.obligraph.dev", "Gamma Finance", ["nbfc"])
    t = (
        await client.post(
            "/api/tasks",
            headers=a["headers"],
            json={
                "title": "File board note",
                "due_on": (date.today() - timedelta(days=3)).isoformat(),
            },
        )
    ).json()
    assert (await run_housekeeping())["overdue_alerts"] == 1
    assert (await run_housekeeping())["overdue_alerts"] == 0
    alert = next(
        x
        for x in (await client.get("/api/alerts", headers=a["headers"])).json()
        if x["kind"] == "task_overdue"
    )
    assert alert["ref_id"] == t["id"] and "Overdue by 3 days" in alert["title"]


# --------------------------------------------------------------------------- SSO

ISSUER = "https://idp.example"
CLIENT = "obligraph-test"


@pytest.fixture
def idp(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "oidc_issuer", ISSUER)
    monkeypatch.setattr(s, "oidc_client_id", CLIENT)
    monkeypatch.setattr(s, "oidc_client_secret", "shh")
    monkeypatch.setattr(s, "public_url", "http://app.test")
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))
    jwk.update({"kid": "k1", "alg": "RS256", "use": "sig"})
    state = {"nonce": None, "email": "new.analyst@alpha.example", "tamper_nonce": False}

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/.well-known/openid-configuration":
            return httpx.Response(
                200,
                json={
                    "issuer": ISSUER,
                    "authorization_endpoint": f"{ISSUER}/authorize",
                    "token_endpoint": f"{ISSUER}/token",
                    "jwks_uri": f"{ISSUER}/jwks",
                },
            )
        if path == "/jwks":
            return httpx.Response(200, json={"keys": [jwk]})
        if path == "/token":
            form = parse_qs(request.content.decode())
            assert (
                form["code_verifier"][0]
                and form["redirect_uri"][0] == "http://app.test/api/auth/sso/callback"
            )
            now = int(time.time())
            claims = {
                "iss": ISSUER,
                "aud": CLIENT,
                "sub": "u-1",
                "email": state["email"],
                "email_verified": True,
                "name": "New Analyst",
                "iat": now,
                "exp": now + 300,
                "nonce": "wrong" if state["tamper_nonce"] else state["nonce"],
            }
            token = jwt.encode(claims, key, algorithm="RS256", headers={"kid": "k1"})
            return httpx.Response(200, json={"id_token": token, "access_token": "x"})
        return httpx.Response(404)

    sso.set_http_factory(lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    yield state
    sso.set_http_factory(lambda: httpx.AsyncClient(timeout=15))


async def _sso_round(client, state) -> str:
    start = await client.get("/api/auth/sso/start")
    assert start.status_code == 302
    q = parse_qs(urlparse(start.headers["location"]).query)
    assert q["code_challenge_method"] == ["S256"] and q["client_id"] == [CLIENT]
    state["nonce"] = q["nonce"][0]
    cb = await client.get(f"/api/auth/sso/callback?code=abc&state={q['state'][0]}")
    assert cb.status_code == 302
    return cb.headers["location"]


async def test_sso_login_provisions_into_matching_org(client, idp):
    assert (await client.get("/api/auth/sso")).json()["enabled"] is True
    a = await register(client, "admin@alpha.example", "Alpha Finance", ["nbfc"])
    await client.patch(
        "/api/org", headers=a["headers"], json={"profile": {"sso_domain": "alpha.example"}}
    )
    target = await _sso_round(client, idp)
    assert target.startswith("http://app.test/sso#token=")
    token = target.split("token=", 1)[1]
    me = (await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})).json()
    assert me["user"]["email"] == "new.analyst@alpha.example"
    assert [(m["org"]["name"], m["role"]) for m in me["memberships"]] == [
        ("Alpha Finance", "member")
    ]

    idp["tamper_nonce"] = True
    assert "error=" in await _sso_round(client, idp)
    idp["tamper_nonce"], idp["email"] = False, "someone@unknown.example"
    assert "no%20organisation" in await _sso_round(client, idp)
    forged = await client.get("/api/auth/sso/callback?code=abc&state=forged")
    assert "error=" in forged.headers["location"]


async def test_workflow_graph_shape():
    g = approvals.build_graph().compile()
    nodes = set(g.get_graph().nodes)
    assert {"notify", "wait_for_checker", "escalate", "approve", "reject", "withdraw"} <= nodes


async def test_approval_withdraw_by_maker(client):
    owner = await register(client, "owner@delta.obligraph.dev", "Delta Finance", ["nbfc"])
    maker = await add_member(client, owner, "maker@delta.obligraph.dev", "member")
    t = (await client.post("/api/tasks", headers=maker, json={"title": "Review KYC policy"})).json()
    appr = (await client.post(f"/api/tasks/{t['id']}/submit", headers=maker, json={})).json()
    w = await client.post(f"/api/approvals/{appr['id']}/withdraw", headers=maker, json={})
    assert w.json()["status"] == "withdrawn"
    async with session_scope() as session:
        task = await session.get(Task, uuid.UUID(t["id"]))
        assert task.status == "doing"
        pending = (
            (
                await session.execute(
                    select(ApprovalRequest).where(ApprovalRequest.status == "pending")
                )
            )
            .scalars()
            .all()
        )
        assert pending == []


async def test_regressions_from_ui_review(client):
    """Catalogue seeding is idempotent; manual escalations record who and why; profile
    changes report their effect on obligations."""
    from sqlalchemy import func

    from obligraph.compliance.filings import seed_catalogue
    from obligraph.models import ReturnType

    async with session_scope() as session:
        await seed_catalogue(session)
        await seed_catalogue(session)
    async with session_scope() as session:
        n = (await session.execute(select(func.count()).select_from(ReturnType))).scalar_one()
        codes = (
            await session.execute(select(func.count(func.distinct(ReturnType.code))))
        ).scalar_one()
    assert n == codes == 11

    owner = await register(client, "owner@eps.obligraph.dev", "Epsilon Finance", ["nbfc"])
    await corpus()
    changed = (
        await client.patch(
            "/api/org", headers=owner["headers"], json={"profile": {"sbr_layer": "base"}}
        )
    ).json()
    assert changed["obligations_retired"] == 7 and changed["obligations_added"] == 0

    maker = await add_member(client, owner, "maker@eps.obligraph.dev", "member")
    t = (await client.post("/api/tasks", headers=maker, json={"title": "Sign-off needed"})).json()
    appr = (await client.post(f"/api/tasks/{t['id']}/submit", headers=maker, json={})).json()
    esc = (
        await client.post(
            f"/api/approvals/{appr['id']}/escalate",
            headers=owner["headers"],
            json={"note": "Board meeting tomorrow"},
        )
    ).json()
    event = esc["history"][-1]
    assert event["event"] == "escalated" and event["note"] == "Board meeting tomorrow"
    assert event["by"] == owner["user_id"] and event["reason"] == "manual"
