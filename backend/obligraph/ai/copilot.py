"""Copilot conversations.

The agent loop runs here on the Messages API: stream a turn, run any tool calls against
Obligraph's own database, send the results back, repeat until Claude answers. Every
API-level message is stored verbatim and replayed append-only on the next turn, so
follow-up questions keep their context (and any thinking blocks stay valid).
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from collections.abc import AsyncIterator

import anthropic
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from obligraph import search
from obligraph.ai import claude
from obligraph.ai.prompts import COPILOT_SYSTEM
from obligraph.ai.tools import ToolContext, tool_definitions
from obligraph.models import ChatMessage, Conversation, Org, User
from obligraph.settings import get_settings
from obligraph.textutil import overlap_score, sentences

log = logging.getLogger(__name__)

MAX_TURNS = 10
REPLAY_ROLES = ("user", "assistant")


async def get_or_create_conversation(
    session: AsyncSession, org: Org, user: User, conversation_id: uuid.UUID | None, first: str
) -> Conversation:
    if conversation_id:
        conv = await session.get(Conversation, conversation_id)
        if conv is None or conv.org_id != org.id or conv.user_id != user.id:
            raise LookupError("conversation not found")
        return conv
    conv = Conversation(
        id=uuid.uuid4(),
        org_id=org.id,
        user_id=user.id,
        title=first.strip()[:80] or "New conversation",
    )
    session.add(conv)
    await session.flush()
    return conv


class _Transcript:
    def __init__(self, session: AsyncSession, conv: Conversation, next_seq: int):
        self.session, self.conv, self.seq = session, conv, next_seq

    def add(
        self,
        role: str,
        content,
        *,
        text: str = "",
        visible: bool = False,
        citations: list | None = None,
    ) -> ChatMessage:
        msg = ChatMessage(
            conversation_id=self.conv.id,
            seq=self.seq,
            role=role,
            content=content,
            text=text,
            visible=visible,
            citations=citations or [],
        )
        self.session.add(msg)
        self.seq += 1
        return msg


async def _history(session: AsyncSession, conv: Conversation) -> tuple[list[dict], int]:
    rows = (
        (
            await session.execute(
                select(ChatMessage)
                .where(ChatMessage.conversation_id == conv.id)
                .order_by(ChatMessage.seq)
            )
        )
        .scalars()
        .all()
    )
    msgs = [{"role": m.role, "content": m.content} for m in rows if m.role in REPLAY_ROLES]
    next_seq = (rows[-1].seq + 1) if rows else 0
    return msgs, next_seq


def _dump(block) -> dict:
    return block.model_dump(mode="json", by_alias=True, exclude_none=True)


async def chat(
    session: AsyncSession,
    *,
    org: Org,
    user: User,
    message: str,
    conversation_id: uuid.UUID | None = None,
) -> AsyncIterator[dict]:
    """Yields events: conversation, text, tool, citations, error, done."""
    conv = await get_or_create_conversation(session, org, user, conversation_id, message)
    history, next_seq = await _history(session, conv)
    transcript = _Transcript(session, conv, next_seq)
    user_content = [{"type": "text", "text": message}]
    transcript.add("user", user_content, text=message, visible=True)
    await session.flush()
    yield {"type": "conversation", "id": str(conv.id), "title": conv.title}

    ctx = ToolContext(session, org)
    if get_settings().claude_enabled:
        stream = _claude_turns(
            session, org, history + [{"role": "user", "content": user_content}], transcript, ctx
        )
    else:
        stream = _offline_answer(session, org, message, transcript, ctx)
    async for event in stream:
        yield event
    conv.updated_at = func.now()
    await session.flush()
    yield {"type": "citations", "citations": ctx.citations}
    yield {"type": "done", "conversation_id": str(conv.id)}


async def _claude_turns(session, org, messages, transcript: _Transcript, ctx: ToolContext):
    settings = get_settings()
    tools = tool_definitions()
    answer_parts: list[str] = []
    last_assistant: ChatMessage | None = None
    json_retries = 0

    for _turn in range(MAX_TURNS):
        started = time.monotonic()
        turn_start = len(answer_parts)
        try:
            async with claude.client().beta.messages.stream(
                model=settings.claude_model,
                max_tokens=64000,
                system=claude.cached_system(COPILOT_SYSTEM),
                tools=tools,
                messages=messages,
                output_config={"effort": settings.effort_copilot},
                cache_control={"type": "ephemeral"},
                betas=claude.BETAS,
                fallbacks=claude.FALLBACKS,
            ) as stream:
                async for event in stream:
                    if event.type == "text":
                        answer_parts.append(event.text)
                        yield {"type": "text", "text": event.text}
                final = await stream.get_final_message()
            json_retries = 0
        except ValueError:
            # Tool-input JSON the SDK could not parse at all: re-issue the turn (bounded),
            # discarding the text the failed attempt streamed into the stored answer.
            del answer_parts[turn_start:]
            json_retries += 1
            if json_retries > 2:
                yield {"type": "error", "message": "The model produced malformed tool input."}
                break
            continue
        except anthropic.APIError as exc:
            claude.record_call(
                session, purpose="copilot", started=started, org_id=org.id, error=repr(exc)
            )
            log.warning("copilot API error: %s", exc)
            yield {"type": "error", "message": "The AI service is unavailable right now."}
            break

        claude.record_call(
            session, purpose="copilot", message=final, started=started, org_id=org.id
        )

        if final.stop_reason == "refusal":
            text = "I can't help with that request."
            answer_parts.append(text)
            yield {"type": "text", "text": text}
            break

        content = [_dump(b) for b in final.content]
        assistant = {"role": "assistant", "content": content}
        tool_uses = [b for b in final.content if b.type == "tool_use"]

        if final.stop_reason == "pause_turn":
            messages.append(assistant)
            last_assistant = transcript.add("assistant", content)
            continue
        if not tool_uses:
            messages.append(assistant)
            last_assistant = transcript.add("assistant", content)
            break
        if final.stop_reason == "max_tokens":
            yield {"type": "error", "message": "The answer was cut off; try a narrower question."}
            break

        results = []
        for block in tool_uses:
            yield {"type": "tool", "name": block.name, "input": block.input}
            results.append(await ctx.run(block.id, block.name, block.input))
        # Persist the tool call and its results together so history never holds a
        # tool_use without its tool_result.
        messages.append(assistant)
        transcript.add("assistant", content)
        messages.append({"role": "user", "content": results})
        transcript.add("user", results)

    answer = "".join(answer_parts).strip()
    if last_assistant is not None:
        last_assistant.visible = True
        last_assistant.text = answer
        last_assistant.citations = ctx.citations
    elif answer:
        transcript.add("note", [], text=answer, visible=True, citations=ctx.citations)
    await session.flush()


def _best_sentences(question: str, text: str, n: int = 2) -> str:
    """The ``n`` sentences of ``text`` most related to the question, in document order."""
    sents = [s for s in sentences(text) if len(s) > 30 and not s.isupper()]
    ranked = sorted(
        range(len(sents)), key=lambda i: overlap_score(question, sents[i]), reverse=True
    )[:n]
    picked = " ".join(sents[i] for i in sorted(ranked))
    return picked[:420] if picked else text[:280]


async def _offline_answer(session, org, question: str, transcript: _Transcript, ctx: ToolContext):
    """Retrieval-only answer: the most relevant sources, clearly labelled as such."""
    regs = await ctx.run("offline-1", "search_regulations", {"query": question, "limit": 5})
    obligations = await ctx.run("offline-2", "list_obligations", {"query": question, "limit": 5})
    policy_hits = await search.search(session, question, scope="policies", org_id=org.id, limit=3)

    reg_results = json.loads(regs["content"]).get("results", []) if not regs.get("is_error") else []
    ob_results = json.loads(obligations["content"]).get("obligations", [])
    lines = [
        "**Offline mode.** Claude is not configured, so Obligraph is showing the most relevant "
        "sources instead of a written answer. Set `ANTHROPIC_API_KEY` to enable full answers.",
        "",
    ]
    if reg_results:
        lines.append("### Relevant regulations")
        grouped: dict[str, list[dict]] = {}
        for r in reg_results:
            grouped.setdefault(r["title"], []).append(r)
        for title, group in grouped.items():
            first = group[0]
            ref = f" ({first['ref_no']})" if first.get("ref_no") else ""
            status = " — **superseded**" if first.get("status") == "superseded" else ""
            text = " ".join(g["passage"] for g in group)
            lines.append(f"- **{title}**{ref}{status}: {_best_sentences(question, text)}")
        lines.append("")
    relevant_obs = [o for o in ob_results if o["requirement"]][:5]
    if relevant_obs:
        lines.append("### Your related obligations")
        lines.append("| Requirement | Severity | Coverage |")
        lines.append("|---|---|---|")
        for o in relevant_obs:
            req = o["requirement"].replace("|", "/")[:140]
            lines.append(f"| {req} | {o['severity']} | {o['coverage']} |")
        lines.append("")
    if policy_hits:
        lines.append("### From your policies")
        for h in policy_hits:
            ctx._cite(
                kind="policy",
                regulation_id=None,
                document_id=str(h.document_id),
                title=h.document_title,
                ref_no=None,
                regulator=None,
                status=None,
                url=None,
            )
            lines.append(f"- **{h.document_title}**: {_best_sentences(question, h.text, 1)}")
    if not (reg_results or relevant_obs or policy_hits):
        lines.append("Nothing in the corpus matched that question.")
    answer = "\n".join(lines).strip()
    for i in range(0, len(answer), 120):
        yield {"type": "text", "text": answer[i : i + 120]}
    transcript.add(
        "assistant",
        [{"type": "text", "text": answer}],
        text=answer,
        visible=True,
        citations=ctx.citations,
    )
    await session.flush()
