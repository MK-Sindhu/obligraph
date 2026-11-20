"use client";

import { ArrowRight, History, RefreshCw } from "lucide-react";
import Link from "next/link";
import { IconButton } from "@/components/ui/button";
import { Panel } from "@/components/ui/misc";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { api, type ActivityOut } from "@/lib/api";
import { fmtDateTime, humanize, relativeTime } from "@/lib/format";
import { useMembers } from "@/lib/members";
import { useQuery } from "@/lib/use-query";

const LIMIT = 100;

/** "obligation.assessed" → "Obligation assessed"; "member.role_changed" → "Member role changed". */
function actionLabel(action: string): string {
  return humanize(action.replace(/\./g, " "));
}

function short(v: unknown, max = 70): string {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Compact, readable summary of an audit event's data payload. */
function summarize(e: ActivityOut, memberName: (id: string) => string | undefined): string[] {
  const d = { ...e.data };
  const out: string[] = [];
  if ("coverage" in d && "previous" in d) {
    out.push(`coverage: ${d.previous} → ${d.coverage}`);
    delete d.coverage;
    delete d.previous;
  }
  if ("from" in d && "to" in d) {
    out.push(`role: ${d.from} → ${d.to}`);
    delete d.from;
    delete d.to;
  }
  for (const [k, v] of Object.entries(d)) {
    if (v === null || v === undefined || v === "" || v === "None") {
      if (k === "owner_id" || k === "assignee_id") out.push(`${humanize(k.replace(/_id$/, ""))}: unassigned`);
      continue;
    }
    if ((k === "owner_id" || k === "assignee_id") && typeof v === "string") {
      out.push(`${humanize(k.replace(/_id$/, "")).toLowerCase()}: ${memberName(v) ?? "a former member"}`);
      continue;
    }
    if (Array.isArray(v)) {
      out.push(`${k.replace(/_/g, " ")}: ${v.join(", ") || "none"}`);
      continue;
    }
    out.push(`${k.replace(/_/g, " ")}: ${short(v)}`);
  }
  return out;
}

function targetHref(e: ActivityOut): { href: string; label: string } | null {
  if (!e.target_id) return null;
  switch (e.target_type) {
    case "obligation":
      return { href: `/obligations?id=${e.target_id}`, label: "View obligation" };
    case "task":
      return e.action === "task.deleted" ? null : { href: `/tasks?task=${e.target_id}`, label: "View task" };
    case "document":
      return e.action === "policy.deleted" ? null : { href: "/policies", label: "View policies" };
    case "user":
      return { href: "/settings?tab=team", label: "View team" };
    default:
      return null;
  }
}

export function ActivityTab() {
  const log = useQuery<ActivityOut[]>("org:activity", (signal) => api.org.activity(LIMIT, { signal }));
  const { byId } = useMembers();
  const memberName = (id: string) => byId.get(id)?.user.name;
  const items = log.data ?? [];

  return (
    <Panel
      title="Activity log"
      meta={log.data ? (items.length >= LIMIT ? `Latest ${LIMIT} events` : `${items.length} events`) : undefined}
      actions={
        <IconButton label="Refresh activity" size="sm" onClick={log.reload} disabled={log.loading}>
          <RefreshCw size={14} className={log.loading && log.data ? "animate-spin" : undefined} />
        </IconButton>
      }
    >
      {log.loading && !log.data && <LoadingRows rows={6} label="Loading activity" />}
      {log.error != null && !log.data && <ErrorState error={log.error} onRetry={log.reload} />}
      {log.data && items.length === 0 && (
        <EmptyState icon={<History size={24} />} title="Nothing recorded yet">
          Assessments, status changes, uploads and membership changes are recorded here as they happen.
        </EmptyState>
      )}
      {items.length > 0 && (
        <ol className="divide-y divide-line px-3 pb-3">
          {items.map((e) => {
            const summary = summarize(e, memberName);
            const target = targetHref(e);
            return (
              <li key={e.id} className="grid gap-x-4 gap-y-1 px-3 py-3.5 sm:grid-cols-[120px_minmax(0,1fr)_auto]">
                <time
                  dateTime={e.created_at}
                  title={fmtDateTime(e.created_at)}
                  className="num pt-px text-[12px] text-ink-3"
                >
                  {relativeTime(e.created_at)}
                </time>
                <div className="min-w-0">
                  <p className="text-[13.5px]">
                    <span className="font-medium text-ink">{actionLabel(e.action)}</span>
                    <span className="text-ink-3"> by {e.actor ?? "Obligraph"}</span>
                  </p>
                  {summary.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {summary.map((s, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-surface-2 px-2.5 py-[3px] font-mono text-[11px] text-ink-2 shadow-inset-sm"
                        >
                          {s}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
                {target ? (
                  <Link
                    href={target.href}
                    className="inline-flex items-center gap-1 self-start whitespace-nowrap rounded-full text-[12.5px] font-medium text-accent hover:underline"
                  >
                    {target.label} <ArrowRight size={12} aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="hidden sm:block" />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
