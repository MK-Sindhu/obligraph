"""Hybrid passage search: Postgres full-text ranking fused with pgvector similarity.

Scopes keep tenants apart: ``regulations`` searches the shared corpus only, and
``policies`` searches one org's uploaded documents only.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from obligraph import embeddings
from obligraph.textutil import STOPWORDS

Scope = Literal["regulations", "policies"]


@dataclass
class Hit:
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_title: str
    text: str
    score: float
    regulation_id: uuid.UUID | None = None
    regulator: str | None = None
    ref_no: str | None = None
    status: str | None = None
    url: str | None = None


def _or_query(q: str) -> str | None:
    words = [w for w in re.findall(r"[a-z0-9]+", q.lower()) if len(w) > 1 and w not in STOPWORDS]
    words = list(dict.fromkeys(words))[:24]
    return " | ".join(words) if words else None


def _scope_sql(scope: Scope) -> str:
    if scope == "regulations":
        return "c.org_id IS NULL AND d.kind = 'regulation'"
    return "c.org_id = :org_id AND d.kind = 'policy'"


async def search(
    session: AsyncSession,
    query: str,
    *,
    scope: Scope = "regulations",
    org_id: uuid.UUID | None = None,
    limit: int = 8,
    regulator: str | None = None,
    document_ids: list[uuid.UUID] | None = None,
) -> list[Hit]:
    if scope == "policies" and org_id is None:
        raise ValueError("policy search needs an org_id")
    where = _scope_sql(scope)
    params: dict = {"org_id": org_id, "k": max(limit * 4, 20)}
    if regulator:
        where += " AND d.regulator = :regulator"
        params["regulator"] = regulator
    if document_ids:
        where += " AND c.document_id = ANY(:doc_ids)"
        params["doc_ids"] = document_ids

    ranked: list[list[uuid.UUID]] = []
    tsq = _or_query(query)
    if tsq:
        rows = await session.execute(
            text(
                f"""SELECT c.id FROM chunks c JOIN documents d ON d.id = c.document_id,
                       to_tsquery('english', :tsq) q
                    WHERE {where} AND c.tsv @@ q
                    ORDER BY ts_rank_cd(c.tsv, q, 32) DESC LIMIT :k"""
            ),
            {**params, "tsq": tsq},
        )
        ranked.append([r[0] for r in rows])

    vector = await embeddings.embed_one(query)
    if vector is not None:
        rows = await session.execute(
            text(
                f"""SELECT c.id FROM chunks c JOIN documents d ON d.id = c.document_id
                    WHERE {where} AND c.embedding IS NOT NULL
                    ORDER BY c.embedding <=> CAST(:vec AS vector) LIMIT :k"""
            ),
            {**params, "vec": str(vector)},
        )
        ranked.append([r[0] for r in rows])

    fused = reciprocal_rank_fusion(ranked)[:limit]
    if not fused:
        return []
    ids = [cid for cid, _ in fused]
    scores = dict(fused)
    rows = await session.execute(
        text(
            """SELECT c.id, c.document_id, d.title, c.text, r.id, d.regulator, r.ref_no,
                      r.status, d.url
               FROM chunks c JOIN documents d ON d.id = c.document_id
               LEFT JOIN regulations r ON r.document_id = d.id
               WHERE c.id = ANY(:ids)"""
        ),
        {"ids": ids},
    )
    by_id = {
        r[0]: Hit(
            chunk_id=r[0],
            document_id=r[1],
            document_title=r[2],
            text=r[3],
            score=scores[r[0]],
            regulation_id=r[4],
            regulator=r[5],
            ref_no=r[6],
            status=r[7],
            url=r[8],
        )
        for r in rows
    }
    return [by_id[i] for i in ids if i in by_id]


def reciprocal_rank_fusion(ranked_lists: list[list], k: int = 60) -> list[tuple]:
    scores: dict = {}
    for ranked in ranked_lists:
        for rank, item in enumerate(ranked):
            scores[item] = scores.get(item, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
