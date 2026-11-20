"""Maker-checker approvals as a LangGraph workflow.

    submit -> notify -> [wait for checker] --approve--> approved
                              ^    |      --reject---> rejected
                              |    |      --withdraw-> withdrawn
                              +----+-- escalate (SLA breached; next level of approver)

Each approval request is one LangGraph thread (thread id = approval id), checkpointed
in Postgres, so a request can wait days for a decision and survive restarts. The
``wait_for_checker`` node pauses with ``interrupt()``; a decision resumes it with
``Command(resume=...)``. Rules a caller can break (maker approving their own work,
wrong role) are checked before resuming, so the graph only ever sees valid decisions.

Graph nodes write through the caller's SQLAlchemy session (passed via a context
variable), so a decision's effects commit atomically with the request that made it.
"""

from __future__ import annotations

import operator
import uuid
from contextvars import ContextVar
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal, TypedDict

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from obligraph.audit import record
from obligraph.models import Alert, ApprovalRequest, Membership, Obligation, Org, Task, User
from obligraph.security import role_at_least
from obligraph.settings import get_settings

Action = Literal["approve", "reject", "withdraw", "escalate"]
MAX_LEVEL = 2
# Who may decide at each escalation level.
LEVEL_ROLE = {0: "admin", 1: "admin", 2: "owner"}
DEFAULT_SLA_DAYS = 2

_session: ContextVar[AsyncSession] = ContextVar("approval_session")


class ApprovalError(Exception):
    """A decision that the rules do not allow (maps to HTTP 403/409)."""

    def __init__(self, message: str, status: int = 409):
        super().__init__(message)
        self.status = status


class State(TypedDict, total=False):
    approval_id: str
    level: int
    decision: dict
    history: Annotated[list[dict], operator.add]


def sla_days(org: Org) -> int:
    value = (org.profile or {}).get("approval_sla_days", DEFAULT_SLA_DAYS)
    return value if isinstance(value, int) and value > 0 else DEFAULT_SLA_DAYS


def requires_approval(org: Org, task: Task, severity: str | None) -> bool:
    """High-impact work needs a second pair of eyes: tasks tied to a high or critical
    obligation, unless the org has switched maker-checker off."""
    if not (org.profile or {}).get("maker_checker", True):
        return False
    return task.obligation_id is not None and severity in ("high", "critical")


def _now() -> datetime:
    return datetime.now(UTC)


async def _load(state: State) -> tuple[AsyncSession, ApprovalRequest, Task, Org]:
    session = _session.get()
    appr = await session.get(ApprovalRequest, uuid.UUID(state["approval_id"]))
    assert appr is not None
    task = await session.get(Task, appr.task_id)
    org = await session.get(Org, appr.org_id)
    assert task is not None and org is not None
    return session, appr, task, org


def _event(kind: str, **data) -> dict:
    return {"event": kind, "at": _now().isoformat(), **{k: v for k, v in data.items() if v}}


# --------------------------------------------------------------------------- nodes


async def notify(state: State) -> State:
    session, appr, task, _org = await _load(state)
    task.status = "review"
    session.add(
        Alert(
            org_id=appr.org_id,
            kind="approval_requested",
            severity="medium",
            title=f"Approval requested: {task.title[:150]}",
            body=appr.maker_note[:500] or "A task is waiting for a checker.",
            ref_type="approval",
            ref_id=appr.id,
        )
    )
    event = _event(
        "submitted", by=str(appr.maker_id) if appr.maker_id else None, note=appr.maker_note
    )
    appr.history = [*appr.history, event]
    return {"level": 0, "history": [event]}


async def wait_for_checker(state: State) -> State:
    # Nothing before interrupt(): the node re-runs from the top when resumed.
    decision = interrupt({"approval_id": state["approval_id"], "level": state.get("level", 0)})
    return {"decision": decision}


def route(state: State) -> str:
    return state["decision"]["action"]


async def escalate(state: State) -> State:
    session, appr, task, org = await _load(state)
    level = min(state.get("level", 0) + 1, MAX_LEVEL)
    appr.level = level
    appr.due_at = _now() + timedelta(days=sla_days(org))
    who = "the organisation's owners" if LEVEL_ROLE[level] == "owner" else "all admins"
    session.add(
        Alert(
            org_id=appr.org_id,
            kind="approval_escalated",
            severity="critical" if level >= MAX_LEVEL else "high",
            title=f"Escalated (level {level}): {task.title[:140]}",
            body=f"No decision within the {sla_days(org)}-day SLA; now with {who}.",
            ref_type="approval",
            ref_id=appr.id,
        )
    )
    d = state["decision"]
    event = _event(
        "escalated",
        level=level,
        by=d.get("actor_id"),
        note=d.get("note"),
        reason="manual" if d.get("actor_id") else "sla_breached",
    )
    appr.history = [*appr.history, event]
    return {"level": level, "history": [event]}


async def _close(state: State, status: str, task_status: str, alert_kind: str) -> State:
    session, appr, task, _org = await _load(state)
    d = state["decision"]
    appr.status = status
    appr.decided_at = _now()
    appr.checker_note = d.get("note", "")
    if status in ("approved", "rejected"):
        appr.checker_id = uuid.UUID(d["actor_id"])
    task.status = task_status
    task.completed_at = _now() if task_status == "done" else None
    event = _event(status, by=d.get("actor_id"), note=d.get("note"))
    appr.history = [*appr.history, event]
    if alert_kind:
        session.add(
            Alert(
                org_id=appr.org_id,
                kind=alert_kind,
                severity="medium" if status == "approved" else "high",
                title=f"{status.title()}: {task.title[:150]}",
                body=d.get("note", "")[:500],
                ref_type="approval",
                ref_id=appr.id,
            )
        )
    await record(
        session,
        org_id=appr.org_id,
        actor_id=uuid.UUID(d["actor_id"]) if d.get("actor_id") else None,
        action=f"approval.{status}",
        target_type="task",
        target_id=task.id,
        data={"approval_id": str(appr.id), "level": appr.level, "note": d.get("note", "")},
    )
    return {"history": [event]}


async def approve(state: State) -> State:
    return await _close(state, "approved", "done", "approval_approved")


async def reject(state: State) -> State:
    return await _close(state, "rejected", "doing", "approval_rejected")


async def withdraw(state: State) -> State:
    return await _close(state, "withdrawn", "doing", "")


def build_graph() -> StateGraph:
    g = StateGraph(State)
    g.add_node("notify", notify)
    g.add_node("wait_for_checker", wait_for_checker)
    g.add_node("escalate", escalate)
    g.add_node("approve", approve)
    g.add_node("reject", reject)
    g.add_node("withdraw", withdraw)
    g.add_edge(START, "notify")
    g.add_edge("notify", "wait_for_checker")
    g.add_conditional_edges(
        "wait_for_checker",
        route,
        {"approve": "approve", "reject": "reject", "withdraw": "withdraw", "escalate": "escalate"},
    )
    g.add_edge("escalate", "wait_for_checker")
    for terminal in ("approve", "reject", "withdraw"):
        g.add_edge(terminal, END)
    return g


# --------------------------------------------------------------------------- runtime

_pool: AsyncConnectionPool | None = None
_compiled = None


def _conninfo() -> str:
    return get_settings().database_url.replace("postgresql+asyncpg://", "postgresql://", 1)


async def init() -> None:
    """Open the checkpointer and create its tables. Call at process start (API lifespan,
    worker, tests), never inside a request: LangGraph's setup uses CREATE INDEX
    CONCURRENTLY, which waits for every open transaction, including the caller's."""
    await graph()


async def graph():
    """The compiled workflow with its Postgres checkpointer (created once per process)."""
    global _pool, _compiled
    if _compiled is None:
        _pool = AsyncConnectionPool(
            _conninfo(),
            min_size=1,
            max_size=4,
            open=False,
            kwargs={"autocommit": True, "prepare_threshold": 0, "row_factory": dict_row},
        )
        await _pool.open()
        saver = AsyncPostgresSaver(_pool)
        await saver.setup()
        _compiled = build_graph().compile(checkpointer=saver)
    return _compiled


async def shutdown() -> None:
    global _pool, _compiled
    if _pool is not None:
        await _pool.close()
    _pool = None
    _compiled = None


async def _run(session: AsyncSession, approval_id: uuid.UUID, payload) -> None:
    token = _session.set(session)
    try:
        await (await graph()).ainvoke(
            payload, config={"configurable": {"thread_id": str(approval_id)}}
        )
    finally:
        _session.reset(token)
    await session.flush()


async def workflow_state(approval_id: uuid.UUID) -> dict:
    """Where the LangGraph thread is: the node it waits on and its checkpointed state."""
    snap = await (await graph()).aget_state({"configurable": {"thread_id": str(approval_id)}})
    return {
        "next": list(snap.next),
        "level": snap.values.get("level", 0),
        "events": len(snap.values.get("history", [])),
    }


# --------------------------------------------------------------------------- service


async def submit(
    session: AsyncSession,
    *,
    org: Org,
    task: Task,
    maker: User,
    note: str,
    evidence_ids: list[uuid.UUID],
) -> ApprovalRequest:
    if task.status == "done":
        raise ApprovalError("task is already done")
    pending = (
        await session.execute(
            select(ApprovalRequest.id).where(
                ApprovalRequest.task_id == task.id, ApprovalRequest.status == "pending"
            )
        )
    ).first()
    if pending:
        raise ApprovalError("this task already has a pending approval")
    appr = ApprovalRequest(
        id=uuid.uuid4(),
        org_id=org.id,
        task_id=task.id,
        maker_id=maker.id,
        maker_note=note,
        evidence_ids=[str(e) for e in evidence_ids],
        due_at=_now() + timedelta(days=sla_days(org)),
        history=[],
    )
    session.add(appr)
    await session.flush()
    await _run(session, appr.id, {"approval_id": str(appr.id), "level": 0, "history": []})
    await record(
        session,
        org_id=org.id,
        actor_id=maker.id,
        action="approval.submitted",
        target_type="task",
        target_id=task.id,
        data={"approval_id": str(appr.id)},
    )
    return appr


async def decide(
    session: AsyncSession,
    *,
    appr: ApprovalRequest,
    action: Action,
    actor: User | None,
    note: str = "",
) -> ApprovalRequest:
    if appr.status != "pending":
        raise ApprovalError(f"approval is already {appr.status}")
    if action in ("approve", "reject"):
        assert actor is not None
        if actor.id == appr.maker_id:
            raise ApprovalError("the maker cannot check their own work", 403)
        m = await session.get(Membership, (actor.id, appr.org_id))
        needed = LEVEL_ROLE[appr.level]
        if m is None or not role_at_least(m.role, needed):
            raise ApprovalError(f"level {appr.level} approvals need the {needed} role", 403)
        if action == "reject" and not note.strip():
            raise ApprovalError("a rejection needs a reason", 422)
    elif action == "withdraw":
        assert actor is not None
        m = await session.get(Membership, (actor.id, appr.org_id))
        if actor.id != appr.maker_id and (m is None or not role_at_least(m.role, "admin")):
            raise ApprovalError("only the maker or an admin can withdraw", 403)
    elif action == "escalate" and appr.level >= MAX_LEVEL:
        raise ApprovalError("already at the highest escalation level")
    await _run(
        session,
        appr.id,
        Command(
            resume={"action": action, "actor_id": str(actor.id) if actor else None, "note": note}
        ),
    )
    await session.refresh(appr)
    return appr


async def escalate_overdue(session: AsyncSession) -> int:
    """Escalate every pending approval past its SLA (run periodically by the worker)."""
    due = (
        (
            await session.execute(
                select(ApprovalRequest).where(
                    ApprovalRequest.status == "pending",
                    ApprovalRequest.due_at < _now(),
                    ApprovalRequest.level < MAX_LEVEL,
                )
            )
        )
        .scalars()
        .all()
    )
    for appr in due:
        await decide(session, appr=appr, action="escalate", actor=None)
    return len(due)


async def severity_of(session: AsyncSession, task: Task) -> str | None:
    if task.obligation_id is None:
        return None
    ob = await session.get(Obligation, task.obligation_id)
    return ob.requirement.severity if ob else None
