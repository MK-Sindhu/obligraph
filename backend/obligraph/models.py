"""Relational schema.

Three layers:
  * corpus   - documents, chunks, regulations, requirements (shared by every tenant)
  * graph    - typed nodes and edges over the corpus (lineage, applicability, topics)
  * tenant   - orgs, obligations, tasks, alerts, policies, conversations (org-scoped)

Tenant isolation is enforced in the query layer: every tenant table carries
``org_id`` and every API query filters on the caller's org.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    Computed,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TSVECTOR, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

EMBEDDING_DIM = 384


class Base(DeclarativeBase):
    pass


def _uuid() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def _created() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


def _str_array() -> Mapped[list[str]]:
    return mapped_column(ARRAY(String), nullable=False, server_default=text("'{}'"), default=list)


# --------------------------------------------------------------------------- identity


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = _uuid()
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = _created()


class Org(Base):
    __tablename__ = "orgs"
    id: Mapped[uuid.UUID] = _uuid()
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    entity_classes: Mapped[list[str]] = _str_array()
    regulators: Mapped[list[str]] = _str_array()
    profile: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = _created()


class Membership(Base):
    __tablename__ = "memberships"
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orgs.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # owner|admin|member|viewer
    created_at: Mapped[datetime] = _created()

    user: Mapped[User] = relationship(lazy="joined")
    org: Mapped[Org] = relationship(lazy="joined")


# --------------------------------------------------------------------------- corpus


class Source(Base):
    """A monitored publication feed (RSS) of a regulator."""

    __tablename__ = "sources"
    id: Mapped[uuid.UUID] = _uuid()
    key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    regulator: Mapped[str] = mapped_column(String(32), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False, default="rss")
    url: Mapped[str] = mapped_column(Text, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_status: Mapped[str | None] = mapped_column(String(16))
    last_error: Mapped[str | None] = mapped_column(Text)
    items_seen: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class Document(Base):
    """Any ingested text: a regulatory publication (org_id NULL) or an org's policy."""

    __tablename__ = "documents"
    id: Mapped[uuid.UUID] = _uuid()
    org_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("orgs.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(16), nullable=False)  # regulation|policy
    title: Mapped[str] = mapped_column(Text, nullable=False)
    regulator: Mapped[str | None] = mapped_column(String(32))
    source_key: Mapped[str | None] = mapped_column(String(64))
    url: Mapped[str | None] = mapped_column(Text)
    filename: Mapped[str | None] = mapped_column(Text)
    published_on: Mapped[date | None] = mapped_column(Date)
    dedupe_key: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    error: Mapped[str | None] = mapped_column(Text)
    meta: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = _created()

    __table_args__ = (Index("ix_documents_org_kind", "org_id", "kind"),)


class Chunk(Base):
    """A retrievable passage of a document, indexed for keyword and vector search."""

    __tablename__ = "chunks"
    id: Mapped[uuid.UUID] = _uuid()
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    org_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("orgs.id", ondelete="CASCADE"))
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    tsv = mapped_column(TSVECTOR, Computed("to_tsvector('english', text)", persisted=True))
    embedding = mapped_column(Vector(EMBEDDING_DIM), nullable=True)

    __table_args__ = (
        Index("ix_chunks_tsv", "tsv", postgresql_using="gin"),
        Index("ix_chunks_document", "document_id"),
        Index("ix_chunks_org", "org_id"),
        Index(
            "ix_chunks_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )


class Regulation(Base):
    __tablename__ = "regulations"
    id: Mapped[uuid.UUID] = _uuid()
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documents.id", ondelete="SET NULL"), unique=True
    )
    node_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("graph_nodes.id"), nullable=False)
    regulator: Mapped[str] = mapped_column(String(32), nullable=False)
    ref_no: Mapped[str | None] = mapped_column(String(200))
    title: Mapped[str] = mapped_column(Text, nullable=False)
    doc_type: Mapped[str] = mapped_column(String(32), nullable=False, default="circular")
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    issued_on: Mapped[date | None] = mapped_column(Date)
    effective_on: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="in_force")
    entity_classes: Mapped[list[str]] = _str_array()
    topics: Mapped[list[str]] = _str_array()
    layers: Mapped[list[str]] = _str_array()
    url: Mapped[str | None] = mapped_column(Text)
    extracted_by: Mapped[str] = mapped_column(String(16), nullable=False, default="offline")
    created_at: Mapped[datetime] = _created()

    requirements: Mapped[list[Requirement]] = relationship(
        back_populates="regulation", cascade="all, delete-orphan", order_by="Requirement.ordinal"
    )

    __table_args__ = (Index("ix_regulations_ref", "ref_no"),)


class Requirement(Base):
    """One discrete, checkable thing a regulation asks of a regulated entity."""

    __tablename__ = "requirements"
    id: Mapped[uuid.UUID] = _uuid()
    regulation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("regulations.id", ondelete="CASCADE"), nullable=False
    )
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    source_quote: Mapped[str] = mapped_column(Text, nullable=False, default="")
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    frequency: Mapped[str] = mapped_column(String(16), nullable=False)
    due_on: Mapped[date | None] = mapped_column(Date)
    entity_classes: Mapped[list[str]] = _str_array()
    topics: Mapped[list[str]] = _str_array()
    # NBFC scale-based regulation layers this binds (base/middle/upper/top); empty = all.
    layers: Mapped[list[str]] = _str_array()
    evidence_hint: Mapped[str] = mapped_column(Text, nullable=False, default="")

    regulation: Mapped[Regulation] = relationship(back_populates="requirements")


# --------------------------------------------------------------------------- graph


class GraphNode(Base):
    __tablename__ = "graph_nodes"
    id: Mapped[uuid.UUID] = _uuid()
    kind: Mapped[str] = mapped_column(String(24), nullable=False)
    key: Mapped[str] = mapped_column(String(300), nullable=False)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    props: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = _created()

    __table_args__ = (UniqueConstraint("kind", "key", name="uq_graph_nodes_kind_key"),)


class GraphEdge(Base):
    __tablename__ = "graph_edges"
    id: Mapped[uuid.UUID] = _uuid()
    src_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("graph_nodes.id", ondelete="CASCADE"), nullable=False
    )
    dst_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("graph_nodes.id", ondelete="CASCADE"), nullable=False
    )
    rel: Mapped[str] = mapped_column(String(24), nullable=False)
    valid_from: Mapped[date | None] = mapped_column(Date)
    props: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = _created()

    __table_args__ = (
        UniqueConstraint("src_id", "dst_id", "rel", name="uq_graph_edges_triple"),
        Index("ix_graph_edges_src", "src_id"),
        Index("ix_graph_edges_dst", "dst_id"),
    )


# --------------------------------------------------------------------------- tenant


class Obligation(Base):
    """A requirement as it applies to one org, with its coverage assessment."""

    __tablename__ = "obligations"
    id: Mapped[uuid.UUID] = _uuid()
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False
    )
    requirement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("requirements.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="open")
    coverage: Mapped[str] = mapped_column(String(16), nullable=False, default="unassessed")
    confidence: Mapped[float | None] = mapped_column(Float)
    rationale: Mapped[str] = mapped_column(Text, nullable=False, default="")
    remediation: Mapped[str] = mapped_column(Text, nullable=False, default="")
    evidence: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    assessed_by: Mapped[str | None] = mapped_column(String(16))
    assessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    # Why an obligation was retired (status not_applicable): superseded | profile | manual
    retired_reason: Mapped[str | None] = mapped_column(String(16))
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    requirement: Mapped[Requirement] = relationship(lazy="joined")

    __table_args__ = (
        UniqueConstraint("org_id", "requirement_id", name="uq_obligations_org_req"),
        Index("ix_obligations_org_coverage", "org_id", "coverage"),
    )


class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[uuid.UUID] = _uuid()
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False
    )
    obligation_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("obligations.id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="todo")
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    due_on: Mapped[date | None] = mapped_column(Date)
    source: Mapped[str] = mapped_column(String(16), nullable=False, default="manual")
    created_at: Mapped[datetime] = _created()
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (Index("ix_tasks_org_status", "org_id", "status"),)


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[uuid.UUID] = _uuid()
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    title: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    ref_type: Mapped[str | None] = mapped_column(String(24))
    ref_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = _created()

    __table_args__ = (Index("ix_alerts_org_created", "org_id", "created_at"),)


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[uuid.UUID] = _uuid()
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(Text, nullable=False, default="New conversation")
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ChatMessage(Base):
    """One API-level message. ``content`` holds the exact blocks exchanged with the
    model so a conversation can be replayed append-only; ``text`` is for display."""

    __tablename__ = "chat_messages"
    id: Mapped[uuid.UUID] = _uuid()
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[list | str] = mapped_column(JSONB, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    citations: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = _created()

    __table_args__ = (UniqueConstraint("conversation_id", "seq", name="uq_chat_messages_seq"),)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[uuid.UUID] = _uuid()
    org_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("orgs.id", ondelete="CASCADE"))
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    target_type: Mapped[str | None] = mapped_column(String(32))
    target_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = _created()

    __table_args__ = (Index("ix_audit_org_created", "org_id", "created_at"),)


class ApprovalRequest(Base):
    """Maker-checker review of a task. The workflow itself runs as a LangGraph thread
    (thread id = this row's id); this row is the queryable record of it."""

    __tablename__ = "approval_requests"
    id: Mapped[uuid.UUID] = _uuid()
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    maker_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    checker_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    maker_note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    checker_note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    evidence_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    history: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = _created()
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_approvals_org_status", "org_id", "status"),
        Index(
            "uq_approvals_one_pending_per_task",
            "task_id",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
    )


class Evidence(Base):
    """An immutable file proving compliance, attached to a task and/or obligation."""

    __tablename__ = "evidence"
    id: Mapped[uuid.UUID] = _uuid()
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"))
    obligation_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("obligations.id", ondelete="SET NULL")
    )
    filing_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("filings.id", ondelete="SET NULL")
    )
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = _created()

    __table_args__ = (Index("ix_evidence_org", "org_id", "created_at"),)


class ReturnType(Base):
    """A statutory return or filing. org_id NULL = the built-in (sample) catalogue."""

    __tablename__ = "return_types"
    id: Mapped[uuid.UUID] = _uuid()
    org_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("orgs.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(String(48), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    regulator: Mapped[str] = mapped_column(String(32), nullable=False)
    entity_classes: Mapped[list[str]] = _str_array()
    layers: Mapped[list[str]] = _str_array()
    frequency: Mapped[str] = mapped_column(String(16), nullable=False)
    due_days: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    portal: Mapped[str | None] = mapped_column(Text)
    sample: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = _created()

    # NULLS NOT DISTINCT: the built-in catalogue (org_id NULL) must also be unique per code.
    __table_args__ = (
        UniqueConstraint(
            "org_id", "code", name="uq_return_types_org_code", postgresql_nulls_not_distinct=True
        ),
    )


class Filing(Base):
    """One period's instance of a return for an org."""

    __tablename__ = "filings"
    id: Mapped[uuid.UUID] = _uuid()
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False
    )
    return_type_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("return_types.id", ondelete="CASCADE"), nullable=False
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    due_on: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    filed_on: Mapped[date | None] = mapped_column(Date)
    reference: Mapped[str] = mapped_column(Text, nullable=False, default="")
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    filed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = _created()

    __table_args__ = (
        UniqueConstraint("org_id", "return_type_id", "period_end", name="uq_filings_period"),
        Index("ix_filings_org_due", "org_id", "due_on"),
    )


class CoverageSnapshot(Base):
    """Daily roll-up per org, for trend lines in the board pack."""

    __tablename__ = "coverage_snapshots"
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orgs.id", ondelete="CASCADE"), primary_key=True
    )
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    covered: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    partial: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    missing: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unassessed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    open_tasks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    overdue_tasks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    coverage_pct: Mapped[float | None] = mapped_column(Float)


# --------------------------------------------------------------------------- operations


class LLMCall(Base):
    """Trace of every model call: cost, latency and outcome, for debugging answers."""

    __tablename__ = "llm_calls"
    id: Mapped[uuid.UUID] = _uuid()
    org_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("orgs.id", ondelete="SET NULL"))
    purpose: Mapped[str] = mapped_column(String(32), nullable=False)
    model: Mapped[str] = mapped_column(String(64), nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cache_read_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cache_write_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    stop_reason: Mapped[str | None] = mapped_column(String(32))
    request_id: Mapped[str | None] = mapped_column(String(64))
    error: Mapped[str | None] = mapped_column(Text)
    meta: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = _created()


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[uuid.UUID] = _uuid()
    kind: Mapped[str] = mapped_column(String(48), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    dedupe_key: Mapped[str | None] = mapped_column(String(200))
    run_after: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _created()
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_jobs_queue", "status", "run_after"),
        Index(
            "uq_jobs_active_dedupe",
            "dedupe_key",
            unique=True,
            postgresql_where=text("status IN ('queued', 'running') AND dedupe_key IS NOT NULL"),
        ),
    )
