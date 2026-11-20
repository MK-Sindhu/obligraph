"""The Claude code paths, driven by a scripted stand-in for the Anthropic client.

The stand-in returns real SDK message objects, so block serialisation and replay are
exercised exactly as they would be against the API.
"""

from __future__ import annotations

import copy
import json
from types import SimpleNamespace

import pytest
from anthropic.types.beta import BetaMessage
from conftest import register
from sqlalchemy import select

from obligraph import jobs
from obligraph.ai import claude
from obligraph.db import session_scope
from obligraph.models import ChatMessage, LLMCall, Regulation
from obligraph.seed import FIXTURES, read_fixture, seed_sample_corpus
from obligraph.settings import get_settings


def message(content: list[dict], stop_reason: str = "end_turn") -> BetaMessage:
    return BetaMessage.model_validate(
        {
            "id": "msg_test",
            "type": "message",
            "role": "assistant",
            "model": "claude-opus-5-5",
            "content": content,
            "stop_reason": stop_reason,
            "stop_sequence": None,
            "usage": {"input_tokens": 1200, "output_tokens": 80, "cache_read_input_tokens": 900},
        }
    )


class FakeStream:
    def __init__(self, msg: BetaMessage):
        self.msg = msg

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def __aiter__(self):
        async def gen():
            for block in self.msg.content:
                if block.type == "text":
                    for i in range(0, len(block.text), 20):
                        yield SimpleNamespace(type="text", text=block.text[i : i + 20])

        return gen()

    async def get_final_message(self) -> BetaMessage:
        return self.msg


class FakeClient:
    def __init__(self, script: list[BetaMessage]):
        self.script = list(script)
        self.calls: list[dict] = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(stream=self._stream))

    def _stream(self, **kwargs):
        self.calls.append(copy.deepcopy({k: v for k, v in kwargs.items() if k != "output_format"}))
        return FakeStream(self.script.pop(0))


@pytest.fixture
def claude_mode(monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_mode", "claude")
    yield
    claude.set_client(None)


async def test_structured_extraction_through_claude(claude_mode):
    meta, text = read_fixture(FIXTURES / "regulations" / "03_cyber_incident_2025.txt")
    extraction = {
        "title": meta["title"],
        "ref_no": "OG/SAMPLE/RBI/2025-26/31",
        "doc_type": "circular",
        "issued_on": "2025-09-02",
        "effective_on": None,
        "summary": "Cyber incident reporting for regulated entities.",
        "entity_classes": ["Banks", "NBFCs", "Payment Aggregators"],
        "topics": ["Cyber security"],
        "sbr_layers": [],
        "parent_acts": [],
        "links": [],
        "requirements": [
            {
                "text": "Report every cyber security incident to RBI and CERT-In within six hours.",
                "source_quote": "Regulated entities shall report every cyber security incident to "
                "the Reserve Bank and to CERT-In within six hours of noticing the "
                "incident.",
                "kind": "reporting",
                "severity": "critical",
                "frequency": "event_driven",
                "due_date": None,
                "entity_classes": [],
                "topics": ["cyber"],
                "sbr_layers": [],
                "evidence_hint": "Incident reports with timestamps.",
            }
        ],
    }
    fake = FakeClient([message([{"type": "text", "text": json.dumps(extraction)}])])
    claude.set_client(fake)

    async with session_scope() as session:
        from obligraph.ingest.pipeline import ingest_regulation

        await ingest_regulation(session, title=meta["title"], text=text, regulator="RBI")
    assert await jobs.drain() == 1

    call = fake.calls[0]
    assert call["model"] == "claude-opus-5-5"
    assert call["fallbacks"] == "default" and "server-side-fallback-2026-07-01" in call["betas"]
    assert call["output_config"] == {"effort": "high"}
    assert call["system"][0]["cache_control"] == {"type": "ephemeral"}
    async with session_scope() as session:
        reg = (await session.execute(select(Regulation))).scalar_one()
        await session.refresh(reg, ["requirements"])
        assert reg.extracted_by == "claude"
        assert reg.entity_classes == ["commercial_bank", "nbfc", "payment_aggregator"]
        assert reg.topics == ["cyber_security"]
        assert reg.requirements[0].severity == "critical"
        trace = (await session.execute(select(LLMCall))).scalar_one()
        assert (trace.purpose, trace.input_tokens, trace.cache_read_tokens) == (
            "extract_regulation",
            1200,
            900,
        )


async def test_copilot_tool_loop_and_append_only_replay(client, claude_mode):
    a = await register(client, "cco@alpha.obligraph.dev", "Alpha Finance", ["nbfc"])
    claude.set_client(None)
    get_settings().ai_mode = "offline"  # ingest the corpus with the offline engine
    async with session_scope() as session:
        await seed_sample_corpus(session)
    await jobs.drain()
    get_settings().ai_mode = "claude"

    fake = FakeClient(
        [
            message(
                [
                    {"type": "thinking", "thinking": "", "signature": "sig-1"},
                    {
                        "type": "tool_use",
                        "id": "toolu_1",
                        "name": "search_regulations",
                        "input": {"query": "periodic updation of KYC", "regulator": "RBI"},
                    },
                ],
                stop_reason="tool_use",
            ),
            message(
                [
                    {
                        "type": "text",
                        "text": "**Every two years for high-risk customers**, per "
                        "the KYC Master Direction (as amended).",
                    }
                ]
            ),
            message([{"type": "text", "text": "Incidents must be reported within six hours."}]),
        ]
    )
    claude.set_client(fake)

    resp = await client.post(
        "/api/copilot/chat", headers=a["headers"], json={"message": "How often must we update KYC?"}
    )
    events = [json.loads(line[6:]) for line in resp.text.splitlines() if line.startswith("data: ")]
    assert [e["type"] for e in events if e["type"] not in ("text",)] == [
        "conversation",
        "tool",
        "citations",
        "done",
    ]
    answer = "".join(e["text"] for e in events if e["type"] == "text")
    assert answer.startswith("**Every two years")
    citations = next(e for e in events if e["type"] == "citations")["citations"]
    assert any(c["ref_no"] == "OG/SAMPLE/RBI/2025-26/01" for c in citations)

    # Second request carried the tool call and its result.
    second = fake.calls[1]["messages"]
    assert [m["role"] for m in second] == ["user", "assistant", "user"]
    assert second[1]["content"][0] == {"type": "thinking", "thinking": "", "signature": "sig-1"}
    tool_result = second[2]["content"][0]
    assert tool_result["tool_use_id"] == "toolu_1" and "is_error" not in tool_result
    assert "Know Your Customer" in tool_result["content"]
    tools = {t["name"] for t in fake.calls[0]["tools"]}
    assert {"trace_lineage", "regulations_in_force_on", "list_obligations"} <= tools

    # Follow-up: the stored history is replayed verbatim (append-only), then the new turn.
    cid = events[0]["id"]
    await client.post(
        "/api/copilot/chat",
        headers=a["headers"],
        json={"message": "And cyber incidents?", "conversation_id": cid},
    )
    replay = fake.calls[2]["messages"]
    assert replay[:3] == second
    assert replay[3]["role"] == "assistant" and replay[3]["content"][0]["type"] == "text"
    assert replay[4] == {
        "role": "user",
        "content": [{"type": "text", "text": "And cyber incidents?"}],
    }

    convo = (await client.get(f"/api/copilot/conversations/{cid}", headers=a["headers"])).json()
    assert [(m["role"], m["text"][:5]) for m in convo["messages"]] == [
        ("user", "How o"),
        ("assistant", "**Eve"),
        ("user", "And c"),
        ("assistant", "Incid"),
    ]
    async with session_scope() as session:
        stored = (await session.execute(select(ChatMessage).order_by(ChatMessage.seq))).scalars()
        assert [m.role for m in stored] == [
            "user",
            "assistant",
            "user",
            "assistant",
            "user",
            "assistant",
        ]
        traces = (await session.execute(select(LLMCall.purpose))).scalars().all()
        assert traces == ["copilot", "copilot", "copilot"]


async def test_copilot_rejects_invalid_tool_input(client, claude_mode):
    a = await register(client, "cco@gamma.obligraph.dev", "Gamma Finance", ["nbfc"])
    fake = FakeClient(
        [
            message(
                [
                    {
                        "type": "tool_use",
                        "id": "toolu_bad",
                        "name": "regulations_in_force_on",
                        "input": {"date": "yesterday"},
                    }
                ],
                stop_reason="tool_use",
            ),
            message([{"type": "text", "text": "I need a date in YYYY-MM-DD form."}]),
        ]
    )
    claude.set_client(fake)
    await client.post(
        "/api/copilot/chat", headers=a["headers"], json={"message": "What was in force?"}
    )
    result = fake.calls[1]["messages"][2]["content"][0]
    assert result["is_error"] is True and "INVALID_INPUT" in result["content"]
