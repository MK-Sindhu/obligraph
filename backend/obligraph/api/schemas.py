"""API request/response models (these also define the OpenAPI contract)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Role = Literal["owner", "admin", "member", "viewer"]
Coverage = Literal["unassessed", "covered", "partial", "missing"]
ObligationStatus = Literal["open", "in_progress", "met", "not_applicable"]
TaskStatus = Literal["todo", "doing", "review", "done"]
Priority = Literal["low", "medium", "high", "urgent"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- auth / org


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str = Field(min_length=1, max_length=200)
    org_name: str = Field(min_length=2, max_length=200)
    entity_classes: list[str] = Field(default_factory=list)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORM):
    id: uuid.UUID
    email: str
    name: str
    is_superuser: bool


class OrgOut(ORM):
    id: uuid.UUID
    name: str
    slug: str
    entity_classes: list[str]
    regulators: list[str]
    profile: dict


class OrgUpdateOut(OrgOut):
    obligations_added: int = 0
    obligations_retired: int = 0


class MembershipOut(BaseModel):
    org: OrgOut
    role: Role


class SessionOut(BaseModel):
    token: str
    user: UserOut
    memberships: list[MembershipOut]


class MeOut(BaseModel):
    user: UserOut
    memberships: list[MembershipOut]
    ai_mode: Literal["claude", "offline"]


class OrgUpdate(BaseModel):
    name: str | None = None
    entity_classes: list[str] | None = None
    regulators: list[str] | None = None
    profile: dict | None = None


class MemberOut(BaseModel):
    user: UserOut
    role: Role
    joined_at: datetime


class MemberCreate(BaseModel):
    email: EmailStr
    name: str
    role: Role = "member"
    password: str | None = Field(
        None, min_length=8, description="Required when the user does not exist yet."
    )


class MemberUpdate(BaseModel):
    role: Role


# --------------------------------------------------------------------------- corpus


class RequirementOut(ORM):
    id: uuid.UUID
    ordinal: int
    text: str
    source_quote: str
    kind: str
    severity: str
    frequency: str
    due_on: date | None
    entity_classes: list[str]
    topics: list[str]
    evidence_hint: str


class RegulationSummary(ORM):
    id: uuid.UUID
    regulator: str
    ref_no: str | None
    title: str
    doc_type: str
    summary: str
    issued_on: date | None
    effective_on: date | None
    status: str
    entity_classes: list[str]
    topics: list[str]
    url: str | None
    extracted_by: str
    requirement_count: int = 0
    applies_to_org: bool = False


class LineageItem(BaseModel):
    node_id: str
    regulation_id: str | None
    title: str
    ref_no: str | None
    issued_on: str | None
    status: str
    is_focus: bool


class GraphEdgeOut(BaseModel):
    id: str
    source: str
    target: str
    rel: str
    valid_from: str | None


class Lineage(BaseModel):
    items: list[LineageItem]
    edges: list[GraphEdgeOut]


class OrgImpactRow(BaseModel):
    obligation_id: uuid.UUID
    requirement_id: uuid.UUID
    coverage: Coverage
    status: ObligationStatus


class RegulationDetail(RegulationSummary):
    requirements: list[RequirementOut]
    lineage: Lineage
    org_impact: list[OrgImpactRow]


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


class IngestText(BaseModel):
    title: str
    text: str = Field(min_length=40)
    regulator: str
    url: str | None = None
    published_on: date | None = None


class IngestResult(BaseModel):
    document_id: uuid.UUID
    created: bool
    status: str


class GraphNodeOut(BaseModel):
    id: str
    kind: str
    key: str
    label: str
    props: dict


class Subgraph(BaseModel):
    nodes: list[GraphNodeOut]
    edges: list[GraphEdgeOut]


class InForceRow(BaseModel):
    regulation_id: str
    title: str
    ref_no: str | None
    regulator: str
    issued_on: str | None
    status_today: str


class SearchHitOut(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_title: str
    text: str
    score: float
    regulation_id: uuid.UUID | None
    regulator: str | None
    ref_no: str | None
    status: str | None
    url: str | None


# --------------------------------------------------------------------------- tenant


class PolicyOut(ORM):
    id: uuid.UUID
    title: str
    filename: str | None
    created_at: datetime
    chars: int = 0
    chunks: int = 0


class Evidence(BaseModel):
    chunk_id: str
    document_id: str
    document_title: str
    quote: str


class ObligationOut(BaseModel):
    id: uuid.UUID
    status: ObligationStatus
    coverage: Coverage
    confidence: float | None
    rationale: str
    remediation: str
    evidence: list[Evidence]
    assessed_by: str | None
    assessed_at: datetime | None
    owner_id: uuid.UUID | None
    requirement: RequirementOut
    regulation: RegulationSummary
    open_tasks: int = 0


class ObligationUpdate(BaseModel):
    status: ObligationStatus | None = None
    owner_id: uuid.UUID | None = None


class TaskOut(ORM):
    id: uuid.UUID
    obligation_id: uuid.UUID | None
    title: str
    detail: str
    status: TaskStatus
    priority: Priority
    assignee_id: uuid.UUID | None
    due_on: date | None
    source: str
    created_at: datetime
    completed_at: datetime | None
    requires_approval: bool = False
    approval_id: uuid.UUID | None = None


class TaskCreate(BaseModel):
    title: str = Field(min_length=1)
    detail: str = ""
    obligation_id: uuid.UUID | None = None
    priority: Priority = "medium"
    assignee_id: uuid.UUID | None = None
    due_on: date | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    detail: str | None = None
    status: TaskStatus | None = None
    priority: Priority | None = None
    assignee_id: uuid.UUID | None = None
    due_on: date | None = None


class CalendarEvent(BaseModel):
    date: date
    kind: Literal["deadline", "recurring", "task", "filing"]
    title: str
    severity: str | None
    status: str
    coverage: str | None
    frequency: str | None
    overdue: bool
    obligation_id: str | None
    task_id: str | None
    filing_id: str | None = None
    regulation_id: str | None
    regulation_title: str | None
    regulator: str | None


class AlertOut(ORM):
    id: uuid.UUID
    kind: str
    severity: str
    title: str
    body: str
    ref_type: str | None
    ref_id: uuid.UUID | None
    read_at: datetime | None
    created_at: datetime


class ActivityOut(BaseModel):
    id: uuid.UUID
    action: str
    actor: str | None
    target_type: str | None
    target_id: uuid.UUID | None
    data: dict
    created_at: datetime


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    conversation_id: uuid.UUID | None = None


class ConversationOut(ORM):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime


class ChatMessageOut(BaseModel):
    id: uuid.UUID
    role: Literal["user", "assistant"]
    text: str
    citations: list[dict]
    created_at: datetime


class ConversationDetail(ConversationOut):
    messages: list[ChatMessageOut]


class SourceOut(ORM):
    id: uuid.UUID
    key: str
    name: str
    regulator: str
    url: str
    enabled: bool
    last_run_at: datetime | None
    last_status: str | None
    last_error: str | None
    items_seen: int


class JobOut(ORM):
    id: uuid.UUID
    kind: str
    status: str
    attempts: int
    last_error: str | None
    created_at: datetime
    finished_at: datetime | None


class Vocabulary(BaseModel):
    entity_classes: list[dict]
    regulators: list[dict]
    topics: list[dict]


# --------------------------------------------------------------------------- evidence


class EvidenceOut(ORM):
    id: uuid.UUID
    task_id: uuid.UUID | None
    obligation_id: uuid.UUID | None
    filing_id: uuid.UUID | None
    filename: str
    content_type: str
    size_bytes: int
    sha256: str
    note: str
    uploaded_by: uuid.UUID | None
    uploaded_by_name: str | None = None
    created_at: datetime


# --------------------------------------------------------------------------- approvals

ApprovalStatus = Literal["pending", "approved", "rejected", "withdrawn"]


class SubmitIn(BaseModel):
    note: str = ""
    evidence_ids: list[uuid.UUID] = Field(default_factory=list)


class DecisionIn(BaseModel):
    note: str = ""


class ApprovalOut(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    task_title: str
    status: ApprovalStatus
    level: int
    required_role: Role
    maker: str | None
    maker_id: uuid.UUID | None
    checker: str | None
    maker_note: str
    checker_note: str
    evidence: list[EvidenceOut]
    history: list[dict]
    due_at: datetime
    overdue: bool
    created_at: datetime
    decided_at: datetime | None
    can_decide: bool = False
    workflow: dict | None = None


# --------------------------------------------------------------------------- filings

FilingStatus = Literal["pending", "overdue", "filed", "late", "waived"]
Frequency = Literal["monthly", "quarterly", "half_yearly", "annual"]


class ReturnTypeOut(ORM):
    id: uuid.UUID
    code: str
    name: str
    regulator: str
    entity_classes: list[str]
    layers: list[str]
    frequency: Frequency
    due_days: int
    description: str
    portal: str | None
    sample: bool
    active: bool
    custom: bool = False
    next_due_on: date | None = None


class ReturnTypeIn(BaseModel):
    code: str = Field(min_length=2, max_length=48)
    name: str = Field(min_length=2)
    regulator: str
    frequency: Frequency
    due_days: int = Field(ge=0, le=365)
    description: str = ""
    portal: str | None = None


class ReturnTypeUpdate(BaseModel):
    name: str | None = None
    frequency: Frequency | None = None
    due_days: int | None = Field(None, ge=0, le=365)
    description: str | None = None
    portal: str | None = None
    active: bool | None = None


class FilingOut(BaseModel):
    id: uuid.UUID
    return_type_id: uuid.UUID
    code: str
    name: str
    regulator: str
    frequency: Frequency
    period_start: date
    period_end: date
    due_on: date
    status: FilingStatus
    filed_on: date | None
    reference: str
    note: str
    sample: bool
    evidence: list[EvidenceOut] = Field(default_factory=list)


class FileIn(BaseModel):
    filed_on: date
    reference: str = Field(min_length=1, description="Acknowledgement / reference number.")
    note: str = ""
    evidence_id: uuid.UUID | None = None


class WaiveIn(BaseModel):
    note: str = Field(min_length=3)
