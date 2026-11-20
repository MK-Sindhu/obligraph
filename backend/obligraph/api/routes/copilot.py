"""Copilot chat over Server-Sent Events, plus conversation history."""

from __future__ import annotations

import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select

from obligraph.ai import copilot
from obligraph.api.deps import Caller, caller
from obligraph.api.schemas import ChatIn, ChatMessageOut, ConversationDetail, ConversationOut
from obligraph.db import session_scope
from obligraph.models import ChatMessage, Conversation, Membership

log = logging.getLogger(__name__)
router = APIRouter(prefix="/copilot", tags=["copilot"])


@router.get("/conversations", response_model=list[ConversationOut])
async def conversations(c: Caller = Depends(caller)) -> list[ConversationOut]:
    rows = (
        await c.session.execute(
            select(Conversation)
            .where(Conversation.org_id == c.org.id, Conversation.user_id == c.user.id)
            .order_by(Conversation.updated_at.desc())
            .limit(100)
        )
    ).scalars()
    return [ConversationOut.model_validate(r) for r in rows]


async def _own(c: Caller, conversation_id: uuid.UUID) -> Conversation:
    conv = await c.session.get(Conversation, conversation_id)
    if conv is None or conv.org_id != c.org.id or conv.user_id != c.user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "conversation not found")
    return conv


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def conversation(
    conversation_id: uuid.UUID, c: Caller = Depends(caller)
) -> ConversationDetail:
    conv = await _own(c, conversation_id)
    msgs = (
        await c.session.execute(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == conv.id, ChatMessage.visible)
            .order_by(ChatMessage.seq)
        )
    ).scalars()
    return ConversationDetail(
        **ConversationOut.model_validate(conv).model_dump(),
        messages=[
            ChatMessageOut(
                id=m.id,
                role="user" if m.role == "user" else "assistant",
                text=m.text,
                citations=m.citations,
                created_at=m.created_at,
            )
            for m in msgs
        ],
    )


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(conversation_id: uuid.UUID, c: Caller = Depends(caller)) -> None:
    await _own(c, conversation_id)
    await c.session.execute(delete(Conversation).where(Conversation.id == conversation_id))


@router.post("/chat")
async def chat(body: ChatIn, c: Caller = Depends(caller)) -> StreamingResponse:
    """Streams ``text/event-stream``. Each event is a JSON object with a ``type`` of
    conversation | text | tool | citations | error | done."""
    if body.conversation_id:
        await _own(c, body.conversation_id)
    user_id, org_id = c.user.id, c.org.id

    async def events():
        # The request-scoped session is closed by the time the body streams, so the
        # conversation runs in its own transaction.
        async with session_scope() as session:
            m = await session.get(Membership, (user_id, org_id))
            try:
                async for event in copilot.chat(
                    session,
                    org=m.org,
                    user=m.user,
                    message=body.message,
                    conversation_id=body.conversation_id,
                ):
                    yield f"data: {json.dumps(event, default=str)}\n\n"
            except LookupError:
                yield f"data: {json.dumps({'type': 'error', 'message': 'conversation not found'})}\n\n"
            except Exception:
                log.exception("copilot failed")
                yield f"data: {json.dumps({'type': 'error', 'message': 'Copilot failed.'})}\n\n"
                raise

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
