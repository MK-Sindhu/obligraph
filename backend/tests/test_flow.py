"""End-to-end over HTTP: tenants, ingestion, lineage, gap analysis, roles, copilot."""

from __future__ import annotations

import json
import uuid

from conftest import register

from obligraph import jobs
from obligraph.db import session_scope
from obligraph.models import Chunk
from obligraph.seed import FIXTURES, seed_sample_corpus
from obligraph.textutil import quote_in


async def ingest_corpus() -> None:
    async with session_scope() as session:
        await seed_sample_corpus(session)
    await jobs.drain()


async def upload(client, headers, path):
    with open(path, "rb") as fh:
        return await client.post(
            "/api/policies",
            headers=headers,
            files={"file": (path.name, fh.read(), "text/markdown")},
        )


def sse(body: str) -> list[dict]:
    return [json.loads(line[6:]) for line in body.splitlines() if line.startswith("data: ")]


async def test_full_compliance_flow(client):
    a = await register(client, "lead@nbfc.obligraph.dev", "Alpha Finance", ["NBFC"])
    assert a["body"]["user"]["is_superuser"] is True  # first user administers the platform
    await ingest_corpus()

    # Obligations were created for the NBFC as each circular arrived; the SEBI AIF circular
    # does not apply to it.
    obs = (await client.get("/api/obligations?limit=200", headers=a["headers"])).json()
    regulators = {o["regulation"]["regulator"] for o in obs["items"]}
    # DPDP (MeitY) and CERT-In bind every organisation regardless of licence.
    assert regulators == {"RBI", "MeitY", "CERT-In"} and obs["total"] >= 20

    # The 2026 code superseded the 2019 one: its obligations were retired, with an alert.
    regs = (await client.get("/api/regulations?q=Fair%20Practices", headers=a["headers"])).json()
    status = {r["ref_no"]: r["status"] for r in regs["items"]}
    assert status == {
        "OG/SAMPLE/RBI/2019-20/07": "superseded",
        "OG/SAMPLE/RBI/2025-26/74": "in_force",
    }
    retired = (
        await client.get(
            "/api/obligations?include_retired=true&status=not_applicable", headers=a["headers"]
        )
    ).json()
    assert retired["total"] == 3
    assert all("Superseded by OG/SAMPLE/RBI/2025-26/74" in o["rationale"] for o in retired["items"])
    alerts = (await client.get("/api/alerts", headers=a["headers"])).json()
    assert {"new_regulation", "superseded"} <= {x["kind"] for x in alerts}

    # Lineage on the amended Master Direction.
    md = next(
        r
        for r in (await client.get("/api/regulations?q=Master", headers=a["headers"])).json()[
            "items"
        ]
        if r["ref_no"] == "OG/SAMPLE/RBI/2025-26/01"
    )
    detail = (await client.get(f"/api/regulations/{md['id']}", headers=a["headers"])).json()
    refs = {i["ref_no"] for i in detail["lineage"]["items"]}
    assert refs == {"OG/SAMPLE/RBI/2025-26/01", "OG/SAMPLE/RBI/2025-26/58"}
    assert [e["rel"] for e in detail["lineage"]["edges"]] == ["AMENDS"]
    assert len(detail["org_impact"]) == 7

    in_force_2020 = (
        await client.get("/api/graph/in-force?on=2020-01-01", headers=a["headers"])
    ).json()
    assert [r["ref_no"] for r in in_force_2020] == ["OG/SAMPLE/RBI/2019-20/07"]

    # Everything is unassessed until policies exist; uploading one triggers assessment.
    dash = (await client.get("/api/dashboard", headers=a["headers"])).json()
    assert dash["coverage_pct"] is None
    for name in ("kyc_aml_policy.md", "information_security_policy.md"):
        resp = await upload(client, a["headers"], FIXTURES / "policies" / name)
        assert resp.status_code == 201, resp.text
    dup = await upload(client, a["headers"], FIXTURES / "policies" / "kyc_aml_policy.md")
    assert dup.status_code == 409
    await jobs.drain()

    obs = (await client.get("/api/obligations?limit=200", headers=a["headers"])).json()["items"]
    coverage = {o["coverage"] for o in obs}
    assert {"covered", "partial", "missing"} <= coverage
    policies = {
        p["id"]: p for p in (await client.get("/api/policies", headers=a["headers"])).json()
    }
    quoted = 0
    async with session_scope() as session:
        for o in obs:
            for ev in o["evidence"]:  # every quote shown to a user is verbatim policy text
                assert ev["document_id"] in policies
                chunk = await session.get(Chunk, uuid.UUID(ev["chunk_id"]))
                assert chunk is not None and quote_in(ev["quote"], chunk.text)
                quoted += 1
    assert quoted > 0
    incident = next(o for o in obs if "six hours" in o["requirement"]["text"])
    assert incident["coverage"] == "partial" and "24 hours" in incident["rationale"]

    dash = (await client.get("/api/dashboard", headers=a["headers"])).json()
    assert 0 < dash["coverage_pct"] < 100
    assert dash["tasks"]["open"] > 0 and dash["heatmap"]["by_topic"]

    cal = (
        await client.get("/api/calendar?start=2026-11-01&end=2027-03-31", headers=a["headers"])
    ).json()
    kinds = {e["kind"] for e in cal}
    assert {"recurring", "deadline", "task"} <= kinds
    assert any(e["kind"] == "deadline" and e["date"] == "2026-12-31" for e in cal)

    # Tasks: AI suggestions exist; a member can move one, and editing protects it from
    # being replaced on re-assessment.
    tasks = (await client.get("/api/tasks", headers=a["headers"])).json()
    guarded = next(t for t in tasks if t["requires_approval"])
    blocked = await client.patch(
        f"/api/tasks/{guarded['id']}", headers=a["headers"], json={"status": "done"}
    )
    assert blocked.status_code == 409 and "maker-checker" in blocked.json()["detail"]
    ai_task = next(t for t in tasks if t["source"] == "ai" and not t["requires_approval"])
    moved = await client.patch(
        f"/api/tasks/{ai_task['id']}", headers=a["headers"], json={"status": "done"}
    )
    assert moved.json()["status"] == "done" and moved.json()["completed_at"]
    assert moved.json()["source"] == "ai_edited"

    activity = (await client.get("/api/org/activity?limit=200", headers=a["headers"])).json()
    assert {"org.created", "policy.uploaded", "task.updated"} <= {e["action"] for e in activity}


async def test_tenant_isolation_and_roles(client):
    a = await register(client, "owner@alpha.obligraph.dev", "Alpha Finance", ["nbfc"])
    b = await register(client, "owner@beta.obligraph.dev", "Beta Fund", ["aif"])
    await ingest_corpus()
    resp = await upload(client, a["headers"], FIXTURES / "policies" / "kyc_aml_policy.md")
    assert resp.status_code == 201
    await jobs.drain()

    a_obs = (await client.get("/api/obligations", headers=a["headers"])).json()["items"]
    b_obs = (await client.get("/api/obligations", headers=b["headers"])).json()["items"]
    assert {o["regulation"]["regulator"] for o in b_obs} == {"SEBI", "MeitY", "CERT-In"}
    assert not {o["id"] for o in a_obs} & {o["id"] for o in b_obs}

    # B cannot read, change or search A's data, and cannot act in A's org.
    target = a_obs[0]["id"]
    assert (await client.get(f"/api/obligations/{target}", headers=b["headers"])).status_code == 404
    assert (
        await client.patch(
            f"/api/obligations/{target}", headers=b["headers"], json={"status": "met"}
        )
    ).status_code == 404
    hits = (
        await client.get(
            "/api/search?q=suspicious%20transactions&scope=policies", headers=b["headers"]
        )
    ).json()
    assert hits == []
    hits = (
        await client.get(
            "/api/search?q=suspicious%20transactions&scope=policies", headers=a["headers"]
        )
    ).json()
    assert hits and all(h["document_title"].startswith("Demo Finance") for h in hits)
    cross = {"Authorization": b["headers"]["Authorization"], "X-Org-Id": a["org_id"]}
    assert (await client.get("/api/obligations", headers=cross)).status_code == 403
    assert (await client.get("/api/policies", headers=b["headers"])).json() == []

    # Roles inside A: a viewer can read but not write.
    add = await client.post(
        "/api/org/members",
        headers=a["headers"],
        json={
            "email": "auditor@alpha.obligraph.dev",
            "name": "Auditor",
            "role": "viewer",
            "password": "viewer-password-1",
        },
    )
    assert add.status_code == 201
    login = await client.post(
        "/api/auth/login",
        json={"email": "auditor@alpha.obligraph.dev", "password": "viewer-password-1"},
    )
    viewer = {"Authorization": f"Bearer {login.json()['token']}"}
    assert (await client.get("/api/obligations", headers=viewer)).status_code == 200
    assert (await client.post("/api/tasks", headers=viewer, json={"title": "x"})).status_code == 403
    assert (
        await upload(client, viewer, FIXTURES / "policies" / "fair_practices_code.md")
    ).status_code == 403
    assert (await client.get("/api/admin/overview", headers=viewer)).status_code == 403
    # The last owner cannot be demoted.
    demote = await client.patch(
        f"/api/org/members/{a['user_id']}", headers=a["headers"], json={"role": "admin"}
    )
    assert demote.status_code == 409


async def test_offline_copilot_conversation(client):
    a = await register(client, "analyst@alpha.obligraph.dev", "Alpha Finance", ["nbfc"])
    await ingest_corpus()

    first = await client.post(
        "/api/copilot/chat",
        headers=a["headers"],
        json={"message": "What are our KYC periodic updation obligations?"},
    )
    events = sse(first.text)
    types = [e["type"] for e in events]
    assert types[0] == "conversation" and types[-2:] == ["citations", "done"]
    answer = "".join(e["text"] for e in events if e["type"] == "text")
    assert "Offline mode" in answer and "Know Your Customer" in answer
    citations = next(e for e in events if e["type"] == "citations")["citations"]
    assert any(c["ref_no"] == "OG/SAMPLE/RBI/2025-26/01" for c in citations)

    cid = events[0]["id"]
    second = await client.post(
        "/api/copilot/chat",
        headers=a["headers"],
        json={"message": "What about cyber incidents?", "conversation_id": cid},
    )
    assert sse(second.text)[-1]["type"] == "done"
    convo = (await client.get(f"/api/copilot/conversations/{cid}", headers=a["headers"])).json()
    assert [m["role"] for m in convo["messages"]] == ["user", "assistant", "user", "assistant"]

    b = await register(client, "other@beta.obligraph.dev", "Beta Fund", ["aif"])
    assert (
        await client.get(f"/api/copilot/conversations/{cid}", headers=b["headers"])
    ).status_code == 404
