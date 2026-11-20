"""Optional local embeddings (fastembed, ONNX). Search degrades to keyword-only without them."""

from __future__ import annotations

import asyncio
import logging

from obligraph.models import EMBEDDING_DIM
from obligraph.settings import get_settings

log = logging.getLogger(__name__)

_model = None
_disabled = False


def _load():
    global _model, _disabled
    if _model is not None or _disabled:
        return _model
    settings = get_settings()
    if settings.embeddings_provider != "fastembed":
        _disabled = True
        return None
    try:
        from fastembed import TextEmbedding

        _model = TextEmbedding(model_name=settings.embedding_model)
    except Exception as exc:  # missing extra, no network for the model download, ...
        log.warning("embeddings disabled: %s", exc)
        _disabled = True
    return _model


def enabled() -> bool:
    return _load() is not None


async def embed(texts: list[str]) -> list[list[float]] | None:
    model = _load()
    if model is None or not texts:
        return None

    def run() -> list[list[float]]:
        vectors = [list(map(float, v)) for v in model.embed(texts)]
        assert all(len(v) == EMBEDDING_DIM for v in vectors), "embedding dim mismatch"
        return vectors

    return await asyncio.to_thread(run)


async def embed_one(text: str) -> list[float] | None:
    out = await embed([text])
    return out[0] if out else None
