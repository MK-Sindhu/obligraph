"use client";

import clsx from "clsx";
import { ArrowUpRight, CircleCheck, CircleSlash, Inbox, ShieldAlert, ShieldCheck, TrendingUp, Undo2, Workflow } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  APPROVAL_EVENT_LABEL,
  ApprovalStatusBadge,
  LevelBadge,
  workflowLabel,
} from "@/components/approvals/approval-parts";
import { EvidenceRow, useEvidenceDownload } from "@/components/evidence/evidence-list";
import { Badge, Chip, CountBadge } from "@/components/ui/badge";
import { Button, IconTile } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/field";
import { Meta, PageHeader, Panel } from "@/components/ui/misc";
import { EmptyState, ErrorState, LoadingRows, Skeleton } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, type ApprovalAction, type ApprovalOut } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDateTime, fmtShortDate, relativeTime } from "@/lib/format";
import { useMembers } from "@/lib/members";
import { useQuery } from "@/lib/use-query";
import { useUrlState } from "@/lib/url-state";

type View = "inbox" | "all";
const STATUS_FILTERS = ["pending", "approved", "rejected", "withdrawn"] as const;

/** "due in 2 d" / "3 h overdue" from an ISO datetime. */
export function slaLabel(dueAt: string, now = Date.now()): string {
  const diff = new Date(dueAt).getTime() - now;
  const abs = Math.abs(diff) / 1000;
  const span = abs < 3600 ? `${Math.max(1, Math.round(abs / 60))} min` : abs < 86400 ? `${Math.round(abs / 3600)} h` : `${Math.round(abs / 86400)} d`;
  return diff >= 0 ? `Due in ${span}` : `${span} overdue`;
}

function ApprovalListItem({ a, selected, href }: { a: ApprovalOut; selected: boolean; href: string }) {
  return (
    <li>
      <Link
        href={href}
        scroll={false}
        aria-current={selected ? "true" : undefined}
        className={clsx(
          "relative block rounded-[20px] px-4 py-3.5 transition-[background-color,box-shadow]",
          selected ? "bg-accent-wash ring-1 ring-accent/30" : "hover:bg-surface-hi hover:shadow-raised-xs",
        )}
      >
        {selected && <span className="absolute inset-y-3 left-0 w-[4px] rounded-full bg-accent-grad-diag" aria-hidden="true" />}
        <div className="flex items-start justify-between gap-3">
          <p className="line-clamp-2 text-[13.5px] font-medium leading-snug text-ink">{a.task_title}</p>
          <ApprovalStatusBadge status={a.status} overdue={a.overdue} size="sm" />
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-3">
          <span>by {a.maker ?? "a former member"}</span>
          <span aria-hidden="true">·</span>
          <span title={fmtDateTime(a.created_at)}>{relativeTime(a.created_at)}</span>
          {a.status === "pending" && (
            <>
              <span aria-hidden="true">·</span>
              <span className={a.overdue ? "font-medium text-danger" : undefined}>{slaLabel(a.due_at)}</span>
            </>
          )}
          {a.level > 0 && <LevelBadge level={a.level} role={a.required_role} />}
        </p>
      </Link>
    </li>
  );
}

const EVENT_TONE: Record<string, "accent" | "warn" | "muted"> = {
  submitted: "accent",
  escalated: "warn",
  approved: "accent",
  rejected: "warn",
  withdrawn: "muted",
};

function HistoryTimeline({ a }: { a: ApprovalOut }) {
  const { byId } = useMembers();
  const name = (id?: string) => (id ? (byId.get(id)?.user.name ?? (id === a.maker_id ? a.maker : null) ?? "a former member") : "Obligraph");
  const items: TimelineItem[] = a.history.map((e, i) => ({
    id: `${e.event}-${i}`,
    pill: APPROVAL_EVENT_LABEL[e.event] ?? e.event,
    // Escalations by the SLA job carry no actor; manual ones may not record it either.
    title: e.event === "escalated" ? `To level ${e.level ?? "?"}${e.by ? ` · ${name(e.by)}` : ""}` : name(e.by),
    meta: fmtDateTime(e.at),
    active: i === a.history.length - 1,
    connector: i > 0 ? fmtShortDate(e.at) : undefined,
    connectorTone: EVENT_TONE[e.event] ?? "accent",
    extra: e.note ? <span className="mt-1.5 line-clamp-3 max-w-[220px] text-[11.5px] italic text-ink-2">&ldquo;{e.note}&rdquo;</span> : undefined,
  }));
  if (a.status === "pending") {
    items.push({
      id: "next",
      pill: "Next",
      title: workflowLabel(a),
      meta: slaLabel(a.due_at),
      muted: true,
    });
  }
  return <Timeline items={items} ariaLabel="Approval history" minItemWidth={180} />;
}

function Decision({ a, onChange }: { a: ApprovalOut; onChange: (a: ApprovalOut) => void }) {
  const { user, can } = useAuth();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<ApprovalAction | null>(null);
  const [tried, setTried] = useState(false);
  if (a.status !== "pending") return null;

  const isMaker = !!user && user.id === a.maker_id;
  const canDecide = !!a.can_decide && !isMaker;
  const canWithdraw = isMaker || can("admin");
  const canEscalate = can("admin") && a.level < 2;
  if (!canDecide && !canWithdraw && !canEscalate) {
    return (
      <p className="rounded-[18px] bg-surface-2 px-4 py-3 text-[13px] text-ink-2 shadow-inset-sm">
        {isMaker
          ? "You submitted this request, so someone else has to check it."
          : `Only ${a.required_role === "owner" ? "owners" : "admins and owners"} can decide at level ${a.level}.`}
      </p>
    );
  }

  async function act(action: ApprovalAction) {
    if (action === "reject" && !note.trim()) {
      setTried(true);
      return;
    }
    setBusy(action);
    try {
      const updated = await api.approvals.decide(a.id, action, note.trim());
      const done: Record<ApprovalAction, string> = {
        approve: "Approved. The task is now done.",
        reject: "Rejected. The task goes back to the maker.",
        withdraw: "Withdrawn. The task is unlocked.",
        escalate: `Escalated to level ${updated.level}.`,
      };
      toast.success(done[action]);
      setNote("");
      setTried(false);
      onChange(updated);
    } catch (e) {
      toast.error("Couldn't record the decision", errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const missing = tried && !note.trim();
  return (
    <div className="rounded-[24px] bg-surface-2 p-4 shadow-inset-sm sm:p-5">
      <Label htmlFor="decision-note" hint={canDecide ? "Required to reject" : "Optional"}>
        {canDecide ? "Checker's note" : "Note"}
      </Label>
      <Textarea
        id="decision-note"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        aria-invalid={missing || undefined}
        aria-describedby={missing ? "decision-note-error" : undefined}
        placeholder={canDecide ? "What you checked, and why you're approving or sending it back." : "Why you're withdrawing or escalating."}
        className={missing ? "border-danger!" : undefined}
      />
      {missing && (
        <p id="decision-note-error" className="mt-1.5 text-[12px] text-danger">
          Say why you&rsquo;re rejecting, so the maker knows what to fix.
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        {canDecide && (
          <>
            <Button variant="primary" icon={<CircleCheck size={15} />} loading={busy === "approve"} disabled={busy !== null} onClick={() => act("approve")}>
              Approve
            </Button>
            <Button variant="secondary" icon={<CircleSlash size={15} />} loading={busy === "reject"} disabled={busy !== null} onClick={() => act("reject")} className="hover:text-danger!">
              Reject
            </Button>
          </>
        )}
        <span className="flex-1" />
        {canEscalate && (
          <Button variant="ghost" size="sm" icon={<TrendingUp size={14} />} loading={busy === "escalate"} disabled={busy !== null} onClick={() => act("escalate")}>
            Escalate
          </Button>
        )}
        {canWithdraw && (
          <Button variant="quiet-danger" size="sm" icon={<Undo2 size={14} />} loading={busy === "withdraw"} disabled={busy !== null} onClick={() => act("withdraw")}>
            Withdraw
          </Button>
        )}
      </div>
    </div>
  );
}

function ApprovalDetail({ id, onChange }: { id: string; onChange: (a: ApprovalOut) => void }) {
  const q = useQuery<ApprovalOut>(`approval:${id}`, (signal) => api.approvals.get(id, { signal }));
  const { download, busy } = useEvidenceDownload();
  const a = q.data && q.data.id === id ? q.data : undefined;

  if (q.error != null && !a) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!a)
    return (
      <div className="space-y-4 px-6 pb-6" role="status" aria-label="Loading approval">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-24 w-full rounded-[20px]" />
        <Skeleton className="h-40 w-full rounded-[20px]" />
      </div>
    );

  const update = (next: ApprovalOut) => {
    q.setData(next);
    onChange(next);
  };

  return (
    <div className="space-y-6 px-6 pb-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <ApprovalStatusBadge status={a.status} overdue={a.overdue} />
          <LevelBadge level={a.level} role={a.required_role} />
        </div>
        <h2 className="display mt-3 text-[20px] leading-snug text-ink">{a.task_title}</h2>
        <Link href={`/tasks?task=${a.task_id}`} className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline">
          Open the task <ArrowUpRight size={13} aria-hidden="true" />
        </Link>
      </div>

      <div className="flex items-center gap-3 rounded-[20px] px-4 py-3 soft-xs">
        <IconTile tone={a.status === "pending" ? "accent" : "soft"} size="sm">
          <Workflow size={15} />
        </IconTile>
        <div className="min-w-0">
          <p className="text-[11.5px] text-ink-3">Workflow</p>
          <p className="text-[13.5px] font-medium text-ink">{workflowLabel(a)}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3 [&>div]:rounded-[18px] [&>div]:bg-surface-2 [&>div]:px-4 [&>div]:py-3 [&>div]:shadow-inset-sm">
        <Meta label="Maker">{a.maker ?? "A former member"}</Meta>
        <Meta label="Checker">{a.checker ?? <span className="text-ink-3">Not decided</span>}</Meta>
        <Meta label="Submitted">{fmtDateTime(a.created_at)}</Meta>
        <Meta label="Decision due (SLA)">
          <span className={a.overdue && a.status === "pending" ? "font-medium text-danger" : undefined}>{fmtDateTime(a.due_at)}</span>
          {a.status === "pending" && <span className="block text-[11.5px] text-ink-3">{slaLabel(a.due_at)}</span>}
        </Meta>
        <Meta label="Decided">{a.decided_at ? fmtDateTime(a.decided_at) : <span className="text-ink-3">Pending</span>}</Meta>
        <Meta label="Needs">{a.required_role === "owner" ? "An owner" : "An admin or owner"}</Meta>
      </dl>

      {(a.maker_note || a.checker_note) && (
        <div className="grid gap-3 md:grid-cols-2">
          {a.maker_note && (
            <figure className="rounded-[20px] px-4 py-3.5 soft-xs">
              <figcaption className="text-[11.5px] font-medium text-ink-3">Maker&rsquo;s note</figcaption>
              <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink">{a.maker_note}</p>
            </figure>
          )}
          {a.checker_note && (
            <figure className="rounded-[20px] px-4 py-3.5 soft-xs">
              <figcaption className="text-[11.5px] font-medium text-ink-3">Checker&rsquo;s note</figcaption>
              <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink">{a.checker_note}</p>
            </figure>
          )}
        </div>
      )}

      <div>
        <p className="mb-2.5 text-[12.5px] font-medium text-ink-3">Evidence submitted</p>
        {a.evidence.length ? (
          <ul className="space-y-2">
            {a.evidence.map((ev) => (
              <EvidenceRow key={ev.id} ev={ev} onDownload={() => download(ev)} downloading={busy === ev.id} />
            ))}
          </ul>
        ) : (
          <p className="rounded-[18px] border border-dashed border-line-strong px-4 py-3 text-[13px] text-ink-3">
            The maker didn&rsquo;t attach evidence.
          </p>
        )}
      </div>

      <div>
        <p className="mb-1 text-[12.5px] font-medium text-ink-3">History</p>
        <HistoryTimeline a={a} />
      </div>

      <Decision a={a} onChange={update} />
    </div>
  );
}

export function ApprovalsView() {
  const { get, set, params } = useUrlState();
  const view: View = get("view") === "all" ? "all" : "inbox";
  const status = get("status");
  const id = get("id") || null;

  const inbox = useQuery<ApprovalOut[]>("approvals:inbox", (signal) => api.approvals.list({ inbox: true, limit: 200 }, { signal }));
  const all = useQuery<ApprovalOut[]>(view === "all" ? `approvals:all:${status}` : null, (signal) =>
    api.approvals.list({ status: status || undefined, limit: 200 }, { signal }),
  );
  const list = view === "inbox" ? inbox : all;
  const items = list.data ?? [];
  const pendingInbox = (inbox.data ?? []).filter((a) => a.status === "pending").length;
  const escalated = (inbox.data ?? []).filter((a) => a.status === "pending" && a.level > 0).length;
  const overdue = (inbox.data ?? []).filter((a) => a.status === "pending" && a.overdue).length;

  function hrefFor(aid: string) {
    const p = new URLSearchParams(params.toString());
    p.set("id", aid);
    return `/approvals?${p.toString()}`;
  }

  function onChange(next: ApprovalOut) {
    const patch = (prev: ApprovalOut[] | undefined) => (prev ?? []).map((x) => (x.id === next.id ? next : x));
    inbox.setData(patch);
    if (all.data) all.setData(patch);
    inbox.reload();
  }

  return (
    <>
      <PageHeader
        eyebrow="Maker-checker"
        title="Approvals"
        description="Tasks that need a second person's sign-off before they count as done. Checkers see their queue here; decisions and evidence are kept for audit."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Tabs
          label="Approval views"
          idPrefix="approvals"
          value={view}
          onChange={(v) => set({ view: v === "all" ? "all" : null, status: null, id: null })}
          tabs={[
            {
              value: "inbox",
              label: (
                <>
                  <Inbox size={14} aria-hidden="true" /> Inbox
                  {pendingInbox > 0 && <CountBadge count={pendingInbox} max={99} />}
                </>
              ),
            },
            { value: "all", label: "All requests" },
          ]}
        />
        {view === "all" && (
          <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
            <Chip active={!status} onClick={() => set({ status: null, id: null })}>
              Any status
            </Chip>
            {STATUS_FILTERS.map((s) => (
              <Chip key={s} active={status === s} onClick={() => set({ status: status === s ? null : s, id: null })}>
                {s === "pending" ? "Pending" : s[0].toUpperCase() + s.slice(1)}
              </Chip>
            ))}
          </div>
        )}
        <span className="flex-1" />
        {overdue > 0 && (
          <Badge tone="danger" icon={<ShieldAlert size={12} />}>
            {overdue} past SLA
          </Badge>
        )}
        {escalated > 0 && <Badge tone="warn">{escalated} escalated</Badge>}
      </div>

      <div
        role="tabpanel"
        id={`approvals-panel-${view}`}
        aria-labelledby={`approvals-tab-${view}`}
        className="grid items-start gap-6 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]"
      >
        <Panel
          title={view === "inbox" ? "Waiting for you" : "Requests"}
          meta={list.data ? `${items.length} ${items.length === 1 ? "request" : "requests"}` : undefined}
        >
          {list.error != null && !list.data ? (
            <ErrorState compact error={list.error} onRetry={list.reload} />
          ) : !list.data ? (
            <LoadingRows rows={4} label="Loading approvals" />
          ) : items.length === 0 ? (
            <EmptyState compact icon={<ShieldCheck size={22} />} title={view === "inbox" ? "Nothing waiting for you" : "No approval requests"}>
              {view === "inbox"
                ? "When a teammate submits a task for sign-off and you can decide it, it shows up here."
                : "Requests appear when a task that needs sign-off is submitted from the task board."}
            </EmptyState>
          ) : (
            <ul className={clsx("space-y-1 px-3 pb-4", list.loading && "opacity-60")}>
              {items.map((a) => (
                <ApprovalListItem key={a.id} a={a} selected={a.id === id} href={hrefFor(a.id)} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Request" className="xl:sticky xl:top-[92px]">
          {id ? (
            <ApprovalDetail key={id} id={id} onChange={onChange} />
          ) : (
            <EmptyState compact icon={<ShieldCheck size={22} />} title="Select a request">
              Pick a request to see the maker&rsquo;s note, the evidence, the history and what the workflow is waiting for.
            </EmptyState>
          )}
        </Panel>
      </div>
    </>
  );
}
