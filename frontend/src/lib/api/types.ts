// Types mirroring backend/openapi.json (hand-written; keep in sync with api/schemas.py).

export type UUID = string;
/** ISO date, YYYY-MM-DD */
export type ISODate = string;
/** ISO date-time */
export type ISODateTime = string;

export type Role = "owner" | "admin" | "member" | "viewer";
export type AiMode = "claude" | "offline";
export type Severity = "critical" | "high" | "medium" | "low";
export type Coverage = "unassessed" | "covered" | "partial" | "missing";
export type ObligationStatus = "open" | "in_progress" | "met" | "not_applicable";
export type TaskStatus = "todo" | "doing" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type CalendarKind = "deadline" | "recurring" | "task" | "filing";
export type RequirementKind = "obligation" | "prohibition" | "reporting" | "disclosure" | "governance";
export type Frequency =
  | "one_time"
  | "ongoing"
  | "event_driven"
  | "monthly"
  | "quarterly"
  | "half_yearly"
  | "annual";

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------- auth / org

export interface UserOut {
  id: UUID;
  email: string;
  name: string;
  is_superuser: boolean;
}

export interface OrgOut {
  id: UUID;
  name: string;
  slug: string;
  entity_classes: string[];
  regulators: string[];
  profile: Record<string, unknown>;
}

export interface MembershipOut {
  org: OrgOut;
  role: Role;
}

export interface SessionOut {
  token: string;
  user: UserOut;
  memberships: MembershipOut[];
}

export interface MeOut {
  user: UserOut;
  memberships: MembershipOut[];
  ai_mode: AiMode;
}

export interface LoginIn {
  email: string;
  password: string;
}

export interface RegisterIn {
  email: string;
  password: string;
  name: string;
  org_name: string;
  entity_classes?: string[];
}

export interface OrgUpdate {
  name?: string | null;
  entity_classes?: string[] | null;
  regulators?: string[] | null;
  profile?: Record<string, unknown> | null;
}

export interface MemberOut {
  user: UserOut;
  role: Role;
  joined_at: ISODateTime;
}

export interface MemberCreate {
  email: string;
  name: string;
  role?: Role;
  password?: string | null;
}

export interface ActivityOut {
  id: UUID;
  action: string;
  actor: string | null;
  target_type: string | null;
  target_id: UUID | null;
  data: Record<string, unknown>;
  created_at: ISODateTime;
}

// ---------------------------------------------------------------- corpus

export interface RequirementOut {
  id: UUID;
  ordinal: number;
  text: string;
  source_quote: string;
  kind: RequirementKind | string;
  severity: Severity | string;
  frequency: Frequency | string;
  due_on: ISODate | null;
  entity_classes: string[];
  topics: string[];
  evidence_hint: string;
}

export interface RegulationSummary {
  id: UUID;
  regulator: string;
  ref_no: string | null;
  title: string;
  doc_type: string;
  summary: string;
  issued_on: ISODate | null;
  effective_on: ISODate | null;
  status: string;
  entity_classes: string[];
  topics: string[];
  url: string | null;
  extracted_by: string;
  requirement_count?: number;
  applies_to_org?: boolean;
}

export interface GraphNodeOut {
  id: string;
  kind: string;
  key: string;
  label: string;
  props: Record<string, unknown>;
}

export interface GraphEdgeOut {
  id: string;
  source: string;
  target: string;
  rel: string;
  valid_from: ISODate | null;
}

export interface Subgraph {
  nodes: GraphNodeOut[];
  edges: GraphEdgeOut[];
}

export interface LineageItem {
  node_id: string;
  regulation_id: UUID | null;
  title: string;
  ref_no: string | null;
  issued_on: ISODate | null;
  /** in_force | superseded | not_ingested | ... */
  status: string;
  is_focus: boolean;
}

export interface Lineage {
  items: LineageItem[];
  edges: GraphEdgeOut[];
}

export interface OrgImpactRow {
  obligation_id: UUID;
  requirement_id: UUID;
  coverage: Coverage;
  status: ObligationStatus;
}

export interface RegulationDetail extends RegulationSummary {
  requirements: RequirementOut[];
  lineage: Lineage;
  org_impact: OrgImpactRow[];
}

export interface InForceRow {
  regulation_id: UUID;
  title: string;
  ref_no: string | null;
  regulator: string;
  issued_on: ISODate | null;
  status_today: string;
}

export interface IngestText {
  title: string;
  text: string;
  regulator: string;
  url?: string | null;
  published_on?: ISODate | null;
}

export interface IngestResult {
  document_id: UUID;
  created: boolean;
  status: string;
}

export interface SearchHitOut {
  chunk_id: UUID;
  document_id: UUID;
  document_title: string;
  text: string;
  score: number;
  regulation_id: UUID | null;
  regulator: string | null;
  ref_no: string | null;
  status: string | null;
  url: string | null;
}

// ---------------------------------------------------------------- compliance

export interface PolicyOut {
  id: UUID;
  title: string;
  filename: string | null;
  created_at: ISODateTime;
  chars: number;
  chunks: number;
}

export interface Evidence {
  chunk_id: string;
  document_id: string;
  document_title: string;
  quote: string;
}

export interface ObligationOut {
  id: UUID;
  status: ObligationStatus;
  coverage: Coverage;
  confidence: number | null;
  rationale: string;
  remediation: string;
  evidence: Evidence[];
  assessed_by: string | null;
  assessed_at: ISODateTime | null;
  owner_id: UUID | null;
  requirement: RequirementOut;
  regulation: RegulationSummary;
  open_tasks: number;
}

export interface ObligationUpdate {
  status?: ObligationStatus | null;
  owner_id?: UUID | null;
}

export interface TaskOut {
  id: UUID;
  obligation_id: UUID | null;
  title: string;
  detail: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: UUID | null;
  due_on: ISODate | null;
  /** "ai" | "ai_edited" | "manual" */
  source: string;
  created_at: ISODateTime;
  completed_at: ISODateTime | null;
  /** Moving to review/done goes through a maker-checker approval. */
  requires_approval?: boolean;
  /** The pending approval, if any (status changes return 409 while it is open). */
  approval_id?: UUID | null;
}

export interface TaskCreate {
  title: string;
  detail?: string;
  obligation_id?: UUID | null;
  priority?: TaskPriority;
  assignee_id?: UUID | null;
  due_on?: ISODate | null;
}

export interface TaskUpdate {
  title?: string | null;
  detail?: string | null;
  status?: TaskStatus | null;
  priority?: TaskPriority | null;
  assignee_id?: UUID | null;
  due_on?: ISODate | null;
}

// ---------------------------------------------------------------- insights

export interface CalendarEvent {
  date: ISODate;
  kind: CalendarKind;
  title: string;
  severity: Severity | string | null;
  status: string;
  coverage: Coverage | null;
  frequency: string | null;
  overdue: boolean;
  obligation_id: string | null;
  task_id: string | null;
  filing_id?: string | null;
  regulation_id: string | null;
  regulation_title: string | null;
  regulator: string | null;
}

export interface HeatmapRow {
  key: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface DashboardAlert {
  id: UUID;
  kind: string;
  severity: Severity | string;
  title: string;
  created_at: ISODateTime;
}

/** GET /api/dashboard (untyped object in openapi; shape from compliance/dashboard.py) */
export interface Dashboard {
  regulations_tracked: number;
  obligations: {
    by_coverage: Partial<Record<Coverage, number>>;
    by_status: Partial<Record<ObligationStatus, number>>;
    total: number;
  };
  coverage_pct: number | null;
  tasks: { open: number; overdue: number; done: number };
  heatmap: {
    severities: Severity[];
    by_topic: HeatmapRow[];
    by_regulator: HeatmapRow[];
  };
  upcoming: CalendarEvent[];
  recent_alerts: DashboardAlert[];
  filings?: { overdue: number; due_30_days: number };
  approvals?: { pending: number; escalated: number };
}

export interface AlertOut {
  id: UUID;
  kind: string;
  severity: Severity | string;
  title: string;
  body: string;
  ref_type: string | null;
  ref_id: UUID | null;
  read_at: ISODateTime | null;
  created_at: ISODateTime;
}

// ---------------------------------------------------------------- copilot

export interface ConversationOut {
  id: UUID;
  title: string;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Citation {
  kind: "regulation" | "policy" | string;
  regulation_id?: UUID | null;
  document_id?: UUID | null;
  title: string;
  ref_no?: string | null;
  regulator?: string | null;
  status?: string | null;
  url?: string | null;
}

export interface ChatMessageOut {
  id: UUID;
  role: "user" | "assistant";
  text: string;
  citations: Citation[];
  created_at: ISODateTime;
}

export interface ConversationDetail extends ConversationOut {
  messages: ChatMessageOut[];
}

export interface ChatIn {
  message: string;
  conversation_id?: UUID | null;
}

export type CopilotEvent =
  | { type: "conversation"; id: UUID; title: string }
  | { type: "text"; text: string }
  | { type: "tool"; name: string; input: Record<string, unknown> }
  | { type: "citations"; citations: Citation[] }
  | { type: "error"; message: string }
  | { type: "done"; conversation_id?: UUID };

// ---------------------------------------------------------------- meta / admin

export interface VocabEntityClass {
  key: string;
  label: string;
  regulator: string;
}

export interface VocabItem {
  key: string;
  label: string;
}

export interface Vocabulary {
  entity_classes: VocabEntityClass[];
  regulators: VocabItem[];
  topics: VocabItem[];
}

export interface AdminOverview {
  ai_mode: AiMode;
  model: string;
  counts: Record<string, number>;
  jobs: Record<string, number>;
  llm_usage: {
    purpose: string;
    calls: number;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    avg_latency_ms: number;
    errors: number;
  }[];
}

export interface SourceOut {
  id: UUID;
  key: string;
  name: string;
  regulator: string;
  url: string;
  enabled: boolean;
  last_run_at: ISODateTime | null;
  last_status: string | null;
  last_error: string | null;
  items_seen: number;
}

export interface JobOut {
  id: UUID;
  kind: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: ISODateTime;
  finished_at: ISODateTime | null;
}

export type GraphStats = {
  nodes: Record<string, number>;
  edges: Record<string, number>;
};

// ---------------------------------------------------------------- evidence

export interface EvidenceOut {
  id: UUID;
  task_id: UUID | null;
  obligation_id: UUID | null;
  filing_id: UUID | null;
  filename: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  note: string;
  uploaded_by: UUID | null;
  uploaded_by_name?: string | null;
  created_at: ISODateTime;
}

export interface EvidenceLink {
  task_id?: UUID | null;
  obligation_id?: UUID | null;
  filing_id?: UUID | null;
}

// ---------------------------------------------------------------- approvals

export type ApprovalStatus = "pending" | "approved" | "rejected" | "withdrawn";
export type ApprovalAction = "approve" | "reject" | "withdraw" | "escalate";

export interface ApprovalEvent {
  event: "submitted" | "escalated" | "approved" | "rejected" | "withdrawn" | string;
  at: ISODateTime;
  /** User id of the actor. */
  by?: UUID;
  note?: string;
  level?: number;
}

export interface ApprovalOut {
  id: UUID;
  task_id: UUID;
  task_title: string;
  status: ApprovalStatus;
  level: number;
  required_role: Role;
  maker: string | null;
  maker_id: UUID | null;
  checker: string | null;
  maker_note: string;
  checker_note: string;
  evidence: EvidenceOut[];
  history: ApprovalEvent[];
  due_at: ISODateTime;
  overdue: boolean;
  created_at: ISODateTime;
  decided_at: ISODateTime | null;
  can_decide?: boolean;
  /** LangGraph thread state: the node it waits on. */
  workflow?: { next: string[]; level: number; events: number } | null;
}

export interface SubmitIn {
  note?: string;
  evidence_ids?: UUID[];
}

// ---------------------------------------------------------------- filings

export type ReturnFrequency = "monthly" | "quarterly" | "half_yearly" | "annual";
export type FilingStatus = "pending" | "overdue" | "filed" | "late" | "waived";

export interface ReturnTypeOut {
  id: UUID;
  code: string;
  name: string;
  regulator: string;
  entity_classes: string[];
  layers: string[];
  frequency: ReturnFrequency;
  due_days: number;
  description: string;
  portal: string | null;
  sample: boolean;
  active: boolean;
  custom?: boolean;
  next_due_on?: ISODate | null;
}

export interface ReturnTypeIn {
  code: string;
  name: string;
  regulator: string;
  frequency: ReturnFrequency;
  due_days: number;
  description?: string;
  portal?: string | null;
}

export interface ReturnTypeUpdate {
  name?: string | null;
  frequency?: ReturnFrequency | null;
  due_days?: number | null;
  description?: string | null;
  portal?: string | null;
  active?: boolean | null;
}

export interface FilingOut {
  id: UUID;
  return_type_id: UUID;
  code: string;
  name: string;
  regulator: string;
  frequency: ReturnFrequency;
  period_start: ISODate;
  period_end: ISODate;
  due_on: ISODate;
  status: FilingStatus;
  filed_on: ISODate | null;
  reference: string;
  note: string;
  sample: boolean;
  evidence?: EvidenceOut[];
}

export interface FileIn {
  filed_on: ISODate;
  reference: string;
  note?: string;
  evidence_id?: UUID | null;
}

// ---------------------------------------------------------------- readiness

export interface PackGap {
  obligation_id: UUID;
  requirement: string;
  severity: Severity | string;
  coverage: Coverage | string;
  regulation: string;
  ref_no: string | null;
}

export interface PackSummary {
  key: string;
  name: string;
  description: string;
  obligations: number;
  by_coverage: Partial<Record<Coverage, number>>;
  readiness_pct: number | null;
  regulations: string[];
  top_gaps: PackGap[];
}

export interface PackItem {
  obligation_id: UUID;
  requirement: string;
  severity: Severity | string;
  kind: string;
  coverage: Coverage | string;
  status: ObligationStatus | string;
  regulation: string;
  regulation_id: UUID;
  ref_no: string | null;
  regulator: string;
}

export interface PackDetail extends PackSummary {
  items: PackItem[];
}

export type SbrLayer = "base" | "middle" | "upper" | "top";

export interface SbrRequirement {
  requirement_id: UUID;
  requirement: string;
  severity: Severity | string;
  layers: SbrLayer[];
  regulation: string;
  regulation_id: UUID;
  ref_no: string | null;
}

export interface SbrOut {
  applicable: boolean;
  current_layer?: SbrLayer | null;
  target_layer?: SbrLayer | null;
  layers?: { key: SbrLayer; label: string; requirements: number }[];
  layer_specific?: SbrRequirement[];
  added_at_target?: SbrRequirement[];
  relieved_at_target?: SbrRequirement[];
  /** Explanation when not applicable (if the API sends one). */
  reason?: string;
  message?: string;
}

// ---------------------------------------------------------------- reports

export interface CoverageRow {
  key: string;
  covered?: number;
  partial?: number;
  missing?: number;
  unassessed?: number;
  total: number;
  coverage_pct: number | null;
}

export interface BoardPack {
  org: { name: string; entity_classes: string[]; sbr_layer?: string | null };
  period: { start: ISODate; end: ISODate; label: string };
  generated_at: ISODateTime;
  headline: {
    coverage_pct: number | null;
    obligations: number;
    by_coverage: Partial<Record<Coverage, number>>;
    open_gaps: number;
    critical_high_gaps: number;
    overdue_tasks: number;
    pending_approvals: number;
    escalated_approvals: number;
    filings: { filed?: number; overdue?: number; late?: number; pending?: number };
  };
  trend: { day: ISODate; coverage_pct: number | null; missing?: number; partial?: number; covered?: number }[];
  by_regulator: CoverageRow[];
  by_topic: CoverageRow[];
  gap_aging: ({ bucket: string } & Partial<Record<Severity, number>>)[];
  critical_gaps: {
    requirement: string;
    severity: Severity | string;
    coverage: Coverage | string;
    regulation: string;
    ref_no: string | null;
    age_days: number;
    obligation_id?: UUID;
  }[];
  new_regulations: { title: string; ref_no?: string | null; regulator?: string; issued_on?: ISODate | null; id?: UUID }[];
  superseded: { title: string; ref_no?: string | null; regulator?: string; superseded_on?: ISODate | null }[];
  overdue_tasks: { title: string; due_on?: ISODate | null; assignee?: string | null; priority?: string }[];
  approvals: { approved: number; rejected: number; pending: number };
  filings_missed: { name: string; due_on: ISODate; status: FilingStatus | string; filed_on?: ISODate | null }[];
  ownership: { owner: string; open: number; share_pct: number }[];
  packs: { name: string; obligations: number; readiness_pct: number | null }[];
  narrative: string[];
}

export interface SsoConfig {
  enabled: boolean;
  name: string;
}
