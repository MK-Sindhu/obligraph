"""Regulation extraction: Claude when available, the offline engine otherwise."""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from obligraph.ai import claude, offline
from obligraph.ai.prompts import EXTRACTION_SYSTEM
from obligraph.ai.schemas import ExtractedRegulation
from obligraph.settings import get_settings

log = logging.getLogger(__name__)

# Opus 5.5 has a 1M-token context, so almost every circular fits in one request. Very
# large compendia are processed in windows rather than truncated.
WINDOW_CHARS = 400_000


def _windows(text: str) -> list[str]:
    if len(text) <= WINDOW_CHARS:
        return [text]
    out, start = [], 0
    while start < len(text):
        end = min(len(text), start + WINDOW_CHARS)
        if end < len(text):
            cut = text.rfind("\n\n", start + WINDOW_CHARS // 2, end)
            end = cut if cut != -1 else end
        out.append(text[start:end])
        start = end
    return out


async def extract(
    session: AsyncSession, *, title: str, text: str, published_on: str | None
) -> tuple[ExtractedRegulation, str]:
    """Returns the extraction and the engine that produced it ("claude" or "offline")."""
    if not get_settings().claude_enabled:
        return offline.extract_regulation(title, text, published_on), "offline"

    windows = _windows(text)
    merged: ExtractedRegulation | None = None
    for i, window in enumerate(windows, start=1):
        part_note = f" (part {i} of {len(windows)})" if len(windows) > 1 else ""
        content = (
            f"<document title={title!r} published_on={published_on!r}{part_note}>\n"
            f"{window}\n</document>\n\nExtract this document."
        )
        result = await claude.structured(
            session,
            purpose="extract_regulation",
            system=EXTRACTION_SYSTEM,
            content=content,
            schema=ExtractedRegulation,
            effort=get_settings().effort_extraction,
        )
        if merged is None:
            merged = result
        else:
            merged.requirements.extend(result.requirements)
            merged.links.extend(result.links)
            for ec in result.entity_classes:
                if ec not in merged.entity_classes:
                    merged.entity_classes.append(ec)
    assert merged is not None
    return merged, "claude"
