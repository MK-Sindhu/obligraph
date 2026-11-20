"""Copilot tools. Each tool is a Pydantic input model plus an async implementation that
only ever reads the shared corpus or the calling org's own data."""

from __future__ import annotations

import json
import uuid
from datetime import timedelta
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from obligraph import clock, graph, search
from obligraph.compliance import calendar
from obligraph.compliance.dashboard import coverage_pct
from obligraph.compliance.obligations import org_regulators
from obligraph.models import Obligation, Org, Regulation, Requirement, Task
from obligraph.textutil import overlap_score, parse_date


class _In(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SearchRegulations(_In):
    query: str = Field(description="What to look for, in plain words.")
    regulator: str | None = Field(None, description="RBI, SEBI, IRDAI, ... to restrict results.")
    limit: int | None = Field(None, description="Max passages, default 6.")


class GetRegulation(_In):
    regulation_id: str | None = Field(None, description="Obligraph regulation id.")
    ref_no: str | None = Field(None, description="Reference number printed on the instrument.")


class TraceLineage(_In):
    regulation_id: str = Field(description="Regulation whose amendment/supersession chain to walk.")


class InForceOn(_In):
    on_date: str = Field(description="YYYY-MM-DD")
    topic: str | None = Field(None, description="Topic key such as kyc or cyber_security.")


class ListObligations(_In):
    coverage: Literal["covered", "partial", "missing", "unassessed"] | None = None
    severity: Literal["low", "medium", "high", "critical"] | None = None
    regulator: str | None = None
    query: str | None = Field(None, description="Keywords to rank obligations by relevance.")
    limit: int | None = Field(None, description="Default 15.")


class ListTasks(_In):
    status: Literal["todo", "doing", "review", "done"] | None = None
    overdue_only: bool | None = None
    limit: int | None = None


class UpcomingDeadlines(_In):
    days: int | None = Field(None, description="Look-ahead window, default 60.")


class SearchPolicies(_In):
    query: str
    limit: int | None = None


class Empty(_In):
    pass


SPECS: dict[str, tuple[type[_In], str]] = {
    "search_regulations": (
        SearchRegulations,
        "Full-text and semantic search over the regulatory corpus (circulars, master "
        "directions, notifications). Returns passages with their instrument.",
    ),
    "get_regulation": (
        GetRegulation,
        "Metadata, status, summary and extracted requirements of one instrument.",
    ),
    "trace_lineage": (
        TraceLineage,
        "Walk the knowledge graph: which instruments this one amends or supersedes, and "
        "which later instruments amend or supersede it. Use before calling something current.",
    ),
    "regulations_in_force_on": (
        InForceOn,
        "Instruments that were issued and not yet superseded on a given date.",
    ),
    "list_obligations": (
        ListObligations,
        "This organisation's obligations with their policy-coverage assessment.",
    ),
    "list_tasks": (ListTasks, "This organisation's remediation and compliance tasks."),
    "upcoming_deadlines": (
        UpcomingDeadlines,
        "Deadlines, recurring filings and task due dates in the coming days.",
    ),
    "search_policies": (SearchPolicies, "Search the organisation's own uploaded policy documents."),
    "get_org_profile": (
        Empty,
        "The organisation's entity types, regulators and overall coverage numbers.",
    ),
}


def _schema(model: type[BaseModel]) -> dict:
    schema = model.model_json_schema()
    schema.pop("title", None)
    for prop in schema.get("properties", {}).values():
        prop.pop("title", None)
    schema.setdefault("properties", {})
    return schema


def tool_definitions() -> list[dict]:
    # Tools stream their (small) inputs as they are generated; inputs are validated
    # client-side against the Pydantic models before anything runs.
    return [
        {
            "name": name,
            "description": desc,
            "input_schema": _schema(model),
            "eager_input_streaming": True,
        }
        for name, (model, desc) in SPECS.items()
    ]


def _trim(text: str, n: int = 900) -> str:
    return text if len(text) <= n else text[: n - 3] + "..."


class ToolContext:
    def __init__(self, session: AsyncSession, org: Org):
        self.session = session
        self.org = org
        self.citations: list[dict] = []
        self._cited: set[str] = set()

    def _cite(self, **c) -> None:
        key = c.get("regulation_id") or c.get("document_id")
        if key and key not in self._cited:
            self._cited.add(key)
            self.citations.append(c)

    async def run(self, tool_use_id: str, name: str, raw_input) -> dict:
        spec = SPECS.get(name)
        if spec is None:
            return _result(tool_use_id, f"Unknown tool {name!r}.", error=True)
        try:
            args = spec[0].model_validate(raw_input if isinstance(raw_input, dict) else {})
        except ValidationError as exc:
            return _result(
                tool_use_id,
                json.dumps(
                    {"INVALID_INPUT": exc.errors(include_url=False, include_context=False)},
                    default=str,
                ),
                error=True,
            )
        try:
            payload = await getattr(self, f"_{name}")(args)
        except (ValueError, LookupError) as exc:
            return _result(tool_use_id, f"Error: {exc}", error=True)
        return _result(tool_use_id, json.dumps(payload, default=str, ensure_ascii=False))

    # ------------------------------------------------------------------ corpus

    async def _search_regulations(self, a: SearchRegulations) -> dict:
        hits = await search.search(
            self.session,
            a.query,
            scope="regulations",
            regulator=a.regulator,
            limit=min(a.limit or 6, 12),
        )
        out = []
        for h in hits:
            self._cite(
                kind="regulation",
                regulation_id=str(h.regulation_id) if h.regulation_id else None,
                document_id=str(h.document_id),
                title=h.document_title,
                ref_no=h.ref_no,
                regulator=h.regulator,
                status=h.status,
                url=h.url,
            )
            out.append(
                {
                    "regulation_id": str(h.regulation_id) if h.regulation_id else None,
                    "title": h.document_title,
                    "ref_no": h.ref_no,
                    "regulator": h.regulator,
                    "status": h.status,
                    "passage": _trim(h.text),
                }
            )
        return {"results": out} if out else {"results": [], "note": "No matching passages."}

    async def _resolve(self, regulation_id: str | None, ref_no: str | None) -> Regulation:
        reg = None
        if regulation_id:
            try:
                reg = await self.session.get(Regulation, uuid.UUID(regulation_id))
            except ValueError:
                reg = None
        if reg is None and ref_no:
            reg = (
                (
                    await self.session.execute(
                        select(Regulation).where(func.lower(Regulation.ref_no) == ref_no.lower())
                    )
                )
                .scalars()
                .first()
            )
        if reg is None:
            raise LookupError("regulation not found; search_regulations first to get its id")
        return reg

    async def _get_regulation(self, a: GetRegulation) -> dict:
        reg = await self._resolve(a.regulation_id, a.ref_no)
        await self.session.refresh(reg, ["requirements"])
        self._cite(
            kind="regulation",
            regulation_id=str(reg.id),
            document_id=None,
            title=reg.title,
            ref_no=reg.ref_no,
            regulator=reg.regulator,
            status=reg.status,
            url=reg.url,
        )
        return {
            "regulation_id": str(reg.id),
            "title": reg.title,
            "ref_no": reg.ref_no,
            "regulator": reg.regulator,
            "type": reg.doc_type,
            "status": reg.status,
            "issued_on": reg.issued_on,
            "effective_on": reg.effective_on,
            "summary": reg.summary,
            "applies_to": reg.entity_classes,
            "topics": reg.topics,
            "requirements": [
                {
                    "text": r.text,
                    "kind": r.kind,
                    "severity": r.severity,
                    "frequency": r.frequency,
                    "due_on": r.due_on,
                }
                for r in reg.requirements[:30]
            ],
        }

    async def _trace_lineage(self, a: TraceLineage) -> dict:
        reg = await self._resolve(a.regulation_id, None)
        chain = await graph.lineage(self.session, reg.node_id)
        by_node = {i["node_id"]: i for i in chain["items"]}
        relations = [
            f"{by_node[e['source']]['title']} {e['rel']} {by_node[e['target']]['title']}"
            + (f" (from {e['valid_from']})" if e["valid_from"] else "")
            for e in chain["edges"]
            if e["source"] in by_node and e["target"] in by_node
        ]
        return {
            "focus": reg.title,
            "instruments": [
                {k: i[k] for k in ("regulation_id", "title", "ref_no", "issued_on", "status")}
                for i in chain["items"]
            ],
            "relations": relations,
        }

    async def _regulations_in_force_on(self, a: InForceOn) -> dict:
        on = parse_date(a.on_date)
        if on is None:
            raise ValueError("on_date must be YYYY-MM-DD")
        return {"on": on, "instruments": await graph.in_force_on(self.session, on, a.topic)}

    # ------------------------------------------------------------------ org data

    async def _list_obligations(self, a: ListObligations) -> dict:
        stmt = (
            select(Obligation, Requirement, Regulation)
            .join(Requirement, Requirement.id == Obligation.requirement_id)
            .join(Regulation, Regulation.id == Requirement.regulation_id)
            .where(Obligation.org_id == self.org.id, Obligation.status != "not_applicable")
        )
        if a.coverage:
            stmt = stmt.where(Obligation.coverage == a.coverage)
        if a.severity:
            stmt = stmt.where(Requirement.severity == a.severity)
        if a.regulator:
            stmt = stmt.where(Regulation.regulator == a.regulator)
        rows = (await self.session.execute(stmt.limit(1000))).all()
        if a.query:
            rows.sort(
                key=lambda r: overlap_score(a.query, f"{r[1].text} {r[2].title}"), reverse=True
            )
        limit = min(a.limit or 15, 40)
        return {
            "total_matching": len(rows),
            "obligations": [
                {
                    "obligation_id": str(o.id),
                    "requirement": _trim(q.text, 400),
                    "regulation": r.title,
                    "ref_no": r.ref_no,
                    "severity": q.severity,
                    "frequency": q.frequency,
                    "due_on": q.due_on,
                    "status": o.status,
                    "coverage": o.coverage,
                    "gap": _trim(o.rationale, 300) if o.rationale else None,
                }
                for o, q, r in rows[:limit]
            ],
        }

    async def _list_tasks(self, a: ListTasks) -> dict:
        stmt = select(Task).where(Task.org_id == self.org.id)
        if a.status:
            stmt = stmt.where(Task.status == a.status)
        if a.overdue_only:
            stmt = stmt.where(Task.due_on < clock.today(), Task.status != "done")
        tasks = (
            (
                await self.session.execute(
                    stmt.order_by(Task.due_on.asc().nulls_last()).limit(min(a.limit or 20, 50))
                )
            )
            .scalars()
            .all()
        )
        return {
            "tasks": [
                {"title": t.title, "status": t.status, "priority": t.priority, "due_on": t.due_on}
                for t in tasks
            ]
        }

    async def _upcoming_deadlines(self, a: UpcomingDeadlines) -> dict:
        today = clock.today()
        evs = await calendar.events(
            self.session, self.org.id, today, today + timedelta(days=min(a.days or 60, 366))
        )
        return {
            "from": today,
            "events": [
                {
                    k: e[k]
                    for k in ("date", "kind", "title", "regulation_title", "severity", "status")
                }
                for e in evs[:40]
            ],
        }

    async def _search_policies(self, a: SearchPolicies) -> dict:
        hits = await search.search(
            self.session, a.query, scope="policies", org_id=self.org.id, limit=min(a.limit or 5, 10)
        )
        for h in hits:
            self._cite(
                kind="policy",
                regulation_id=None,
                document_id=str(h.document_id),
                title=h.document_title,
                ref_no=None,
                regulator=None,
                status=None,
                url=None,
            )
        return (
            {"results": [{"document": h.document_title, "passage": _trim(h.text)} for h in hits]}
            if hits
            else {"results": [], "note": "No policy passages matched."}
        )

    async def _get_org_profile(self, _a: Empty) -> dict:
        counts = {
            k: n
            for k, n in await self.session.execute(
                select(Obligation.coverage, func.count())
                .where(Obligation.org_id == self.org.id, Obligation.status != "not_applicable")
                .group_by(Obligation.coverage)
            )
        }
        return {
            "name": self.org.name,
            "entity_classes": self.org.entity_classes,
            "regulators": org_regulators(self.org),
            "obligations_by_coverage": counts,
            "coverage_pct": coverage_pct(counts),
        }


def _result(tool_use_id: str, content: str, error: bool = False) -> dict:
    out = {"type": "tool_result", "tool_use_id": tool_use_id, "content": content}
    if error:
        out["is_error"] = True
    return out
