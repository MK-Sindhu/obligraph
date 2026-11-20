"""Knowledge graph over the regulatory corpus.

Node kinds: regulation, regulator, entity_class, topic, act.
Edge rels:  ISSUED_BY, APPLIES_TO, COVERS, DERIVED_FROM, AMENDS, SUPERSEDES, REFERENCES.

Lineage (AMENDS / SUPERSEDES / REFERENCES between regulations) is what lets Obligraph
answer "is this still current?" and "what changed since?".
"""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from obligraph.models import GraphEdge, GraphNode, Regulation

LINEAGE_RELS = ("AMENDS", "SUPERSEDES", "REFERENCES")


async def upsert_node(
    session: AsyncSession, kind: str, key: str, label: str, props: dict | None = None
) -> uuid.UUID:
    stmt = (
        insert(GraphNode)
        .values(id=uuid.uuid4(), kind=kind, key=key[:300], label=label, props=props or {})
        .on_conflict_do_update(
            constraint="uq_graph_nodes_kind_key",
            set_={"label": label, "props": GraphNode.props.op("||")(props or {})},
        )
        .returning(GraphNode.id)
    )
    return (await session.execute(stmt)).scalar_one()


async def link(
    session: AsyncSession,
    src: uuid.UUID,
    dst: uuid.UUID,
    rel: str,
    *,
    valid_from: date | None = None,
    props: dict | None = None,
) -> None:
    if src == dst:
        return
    stmt = (
        insert(GraphEdge)
        .values(
            id=uuid.uuid4(),
            src_id=src,
            dst_id=dst,
            rel=rel,
            valid_from=valid_from,
            props=props or {},
        )
        .on_conflict_do_nothing(constraint="uq_graph_edges_triple")
    )
    await session.execute(stmt)


def _node_json(row) -> dict:
    return {
        "id": str(row.id),
        "kind": row.kind,
        "key": row.key,
        "label": row.label,
        "props": row.props,
    }


def _edge_json(row) -> dict:
    return {
        "id": str(row.id),
        "source": str(row.src_id),
        "target": str(row.dst_id),
        "rel": row.rel,
        "valid_from": row.valid_from.isoformat() if row.valid_from else None,
    }


async def lineage(session: AsyncSession, node_id: uuid.UUID, depth: int = 6) -> dict:
    """Every regulation connected to ``node_id`` through lineage edges, both directions."""
    rows = await session.execute(
        text(
            """WITH RECURSIVE walk(id, depth) AS (
                   SELECT CAST(:start AS uuid), 0
                   UNION
                   SELECT CASE WHEN e.src_id = w.id THEN e.dst_id ELSE e.src_id END, w.depth + 1
                   FROM walk w JOIN graph_edges e ON (e.src_id = w.id OR e.dst_id = w.id)
                   WHERE e.rel IN ('AMENDS', 'SUPERSEDES') AND w.depth < :depth)
               SELECT DISTINCT id FROM walk"""
        ),
        {"start": node_id, "depth": depth},
    )
    ids = [r[0] for r in rows]
    nodes = (await session.execute(select(GraphNode).where(GraphNode.id.in_(ids)))).scalars().all()
    edges = (
        (
            await session.execute(
                select(GraphEdge).where(
                    GraphEdge.rel.in_(("AMENDS", "SUPERSEDES")),
                    GraphEdge.src_id.in_(ids),
                    GraphEdge.dst_id.in_(ids),
                )
            )
        )
        .scalars()
        .all()
    )
    regs = {
        r.node_id: r
        for r in (
            await session.execute(select(Regulation).where(Regulation.node_id.in_(ids)))
        ).scalars()
    }
    items = []
    for n in nodes:
        r = regs.get(n.id)
        items.append(
            {
                "node_id": str(n.id),
                "regulation_id": str(r.id) if r else None,
                "title": r.title if r else n.label,
                "ref_no": r.ref_no if r else n.props.get("ref_no"),
                "issued_on": r.issued_on.isoformat() if r and r.issued_on else None,
                "status": r.status if r else "not_ingested",
                "is_focus": n.id == node_id,
            }
        )
    items.sort(key=lambda i: (i["issued_on"] or "9999", i["title"]))
    return {"items": items, "edges": [_edge_json(e) for e in edges]}


async def neighborhood(session: AsyncSession, node_id: uuid.UUID, limit: int = 120) -> dict:
    edges = (
        (
            await session.execute(
                select(GraphEdge)
                .where((GraphEdge.src_id == node_id) | (GraphEdge.dst_id == node_id))
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    ids = {node_id} | {e.src_id for e in edges} | {e.dst_id for e in edges}
    nodes = (await session.execute(select(GraphNode).where(GraphNode.id.in_(ids)))).scalars().all()
    return {"nodes": [_node_json(n) for n in nodes], "edges": [_edge_json(e) for e in edges]}


async def overview(
    session: AsyncSession,
    *,
    entity_classes: list[str] | None = None,
    topic: str | None = None,
    limit: int = 300,
) -> dict:
    """A readable subgraph: regulations (optionally filtered) plus their direct neighbours."""
    where = ["n.kind = 'regulation'"]
    params: dict = {"limit": limit}
    if topic:
        where.append(
            "EXISTS (SELECT 1 FROM graph_edges e JOIN graph_nodes t ON t.id = e.dst_id "
            "WHERE e.src_id = n.id AND e.rel = 'COVERS' AND t.key = :topic)"
        )
        params["topic"] = topic
    if entity_classes:
        where.append(
            "EXISTS (SELECT 1 FROM graph_edges e JOIN graph_nodes t ON t.id = e.dst_id "
            "WHERE e.src_id = n.id AND e.rel = 'APPLIES_TO' AND t.key = ANY(:ecs))"
        )
        params["ecs"] = entity_classes
    reg_ids = [
        r[0]
        for r in await session.execute(
            text(
                f"SELECT n.id FROM graph_nodes n WHERE {' AND '.join(where)} "
                "ORDER BY n.created_at DESC LIMIT :limit"
            ),
            params,
        )
    ]
    if not reg_ids:
        return {"nodes": [], "edges": []}
    edges = (
        (
            await session.execute(
                select(GraphEdge).where(
                    GraphEdge.src_id.in_(reg_ids) | GraphEdge.dst_id.in_(reg_ids)
                )
            )
        )
        .scalars()
        .all()
    )
    ids = set(reg_ids) | {e.src_id for e in edges} | {e.dst_id for e in edges}
    nodes = (await session.execute(select(GraphNode).where(GraphNode.id.in_(ids)))).scalars().all()
    return {"nodes": [_node_json(n) for n in nodes], "edges": [_edge_json(e) for e in edges]}


async def in_force_on(session: AsyncSession, on: date, topic: str | None = None) -> list[dict]:
    """Regulations issued by ``on`` that had not been superseded by then."""
    params: dict = {"on": on}
    topic_sql = ""
    if topic:
        topic_sql = "AND :topic = ANY(r.topics)"
        params["topic"] = topic
    rows = await session.execute(
        text(
            f"""SELECT r.id, r.title, r.ref_no, r.regulator, r.issued_on, r.status
                FROM regulations r
                WHERE (r.issued_on IS NULL OR r.issued_on <= :on) {topic_sql}
                  AND NOT EXISTS (
                    SELECT 1 FROM graph_edges e JOIN regulations s ON s.node_id = e.src_id
                    WHERE e.dst_id = r.node_id AND e.rel = 'SUPERSEDES'
                      AND COALESCE(e.valid_from, s.effective_on, s.issued_on) <= :on)
                ORDER BY r.issued_on DESC NULLS LAST LIMIT 200"""
        ),
        params,
    )
    return [
        {
            "regulation_id": str(r[0]),
            "title": r[1],
            "ref_no": r[2],
            "regulator": r[3],
            "issued_on": r[4].isoformat() if r[4] else None,
            "status_today": r[5],
        }
        for r in rows
    ]


async def stats(session: AsyncSession) -> dict:
    rows = await session.execute(text("SELECT kind, count(*) FROM graph_nodes GROUP BY kind"))
    nodes = {k: n for k, n in rows}
    rows = await session.execute(text("SELECT rel, count(*) FROM graph_edges GROUP BY rel"))
    edges = {k: n for k, n in rows}
    return {"nodes": nodes, "edges": edges}
