"""The one place Obligraph talks to Claude.

Every request goes through the beta Messages endpoint so it can opt into
server-side refusal fallbacks, and every response is traced to ``llm_calls``
(tokens, cache hits, latency, stop reason, request id).
"""

from __future__ import annotations

import time
import uuid
from typing import TypeVar

import anthropic
from anthropic import AsyncAnthropic
from pydantic import BaseModel, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from obligraph.models import LLMCall
from obligraph.settings import get_settings

T = TypeVar("T", bound=BaseModel)

# Server-side fallback: if a safety classifier declines a request, the API re-runs it on
# Anthropic's recommended fallback model inside the same call instead of refusing.
BETAS = ["server-side-fallback-2026-07-01"]
FALLBACKS = "default"


class ClaudeError(RuntimeError):
    """The model could not produce a usable answer (refusal, truncation, bad output)."""


_client: AsyncAnthropic | None = None


def client() -> AsyncAnthropic:
    global _client
    if _client is None:
        key = get_settings().anthropic_api_key
        # Without an explicit key the SDK resolves credentials itself (environment
        # variables, then an `ant auth login` profile).
        _client = (
            AsyncAnthropic(api_key=key, max_retries=3) if key else AsyncAnthropic(max_retries=3)
        )
    return _client


def set_client(fake) -> None:
    """Test hook: swap in a stand-in client."""
    global _client
    _client = fake


def record_call(
    session: AsyncSession,
    *,
    purpose: str,
    message=None,
    started: float,
    org_id: uuid.UUID | None = None,
    error: str | None = None,
    meta: dict | None = None,
) -> None:
    usage = getattr(message, "usage", None)
    session.add(
        LLMCall(
            org_id=org_id,
            purpose=purpose,
            model=getattr(message, "model", None) or get_settings().claude_model,
            input_tokens=getattr(usage, "input_tokens", 0) or 0,
            output_tokens=getattr(usage, "output_tokens", 0) or 0,
            cache_read_tokens=getattr(usage, "cache_read_input_tokens", 0) or 0,
            cache_write_tokens=getattr(usage, "cache_creation_input_tokens", 0) or 0,
            latency_ms=int((time.monotonic() - started) * 1000),
            stop_reason=getattr(message, "stop_reason", None),
            request_id=getattr(message, "_request_id", None),
            error=error,
            meta=meta or {},
        )
    )


def cached_system(text: str) -> list[dict]:
    return [{"type": "text", "text": text, "cache_control": {"type": "ephemeral"}}]


async def structured(
    session: AsyncSession,
    *,
    purpose: str,
    system: str,
    content: str | list[dict],
    schema: type[T],
    effort: str,
    org_id: uuid.UUID | None = None,
    max_tokens: int = 32000,
) -> T:
    """One request whose answer is validated against ``schema``.

    Streams under the hood (large ``max_tokens`` without streaming risks HTTP
    timeouts) and returns the parsed model."""
    settings = get_settings()
    started = time.monotonic()
    message = None
    try:
        async with client().beta.messages.stream(
            model=settings.claude_model,
            max_tokens=max_tokens,
            system=cached_system(system),
            messages=[{"role": "user", "content": content}],
            output_format=schema,
            output_config={"effort": effort},
            betas=BETAS,
            fallbacks=FALLBACKS,
        ) as stream:
            message = await stream.get_final_message()
    except anthropic.APIError as exc:
        record_call(session, purpose=purpose, started=started, org_id=org_id, error=repr(exc))
        raise

    record_call(session, purpose=purpose, message=message, started=started, org_id=org_id)

    if message.stop_reason == "refusal":
        details = getattr(message, "stop_details", None)
        raise ClaudeError(f"model declined ({getattr(details, 'category', None)})")
    if message.stop_reason == "max_tokens":
        raise ClaudeError("structured output truncated at max_tokens")

    parsed = getattr(message, "parsed_output", None)
    if isinstance(parsed, schema):
        return parsed
    text = next((b.text for b in message.content if b.type == "text"), "")
    try:
        return schema.model_validate_json(text)
    except ValidationError as exc:
        raise ClaudeError(f"output failed validation: {exc.error_count()} errors") from exc
