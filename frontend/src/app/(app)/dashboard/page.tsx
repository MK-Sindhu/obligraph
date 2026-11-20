"use client";

import clsx from "clsx";
import { AlarmClock, ArrowRight, BellRing, CalendarCheck2, FileStack, ScrollText, ShieldAlert, SquareKanban, Stamp, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { CoverageLegend, CoverageRing } from "@/components/dashboard/coverage-ring";
import { RiskHeatmap } from "@/components/dashboard/heatmap";
import { SeverityGlyph } from "@/components/domain/badges";
import { EventKindIcon, eventHref, eventSubtitle } from "@/components/domain/events";
import { ArrowBadge, Badge } from "@/components/ui/badge";
import { IconTile } from "@/components/ui/button";
import { cardClass, StatTile } from "@/components/ui/card";
import { AreaChart } from "@/components/ui/charts";
import { PageHeader, Panel } from "@/components/ui/misc";
import { ProgressSlider } from "@/components/ui/progress";
import { EmptyState, ErrorState, LoadingRows, Skeleton } from "@/components/ui/states";
import { api, type AlertOut, type CalendarEvent, type Dashboard } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { daysUntil, dueLabel, fmtDate, humanize, OBLIGATION_STATUS_LABEL, parseDate, relativeTime, todayISO } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { useVocab } from "@/lib/vocab";

function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong/70 bg-surface px-3.5 text-[12.5px] font-medium text-accent shadow-xs transition-shadow hover:shadow-card"
    >
      {children} <ArrowRight size={13} aria-hidden="true" />
    </Link>
  );
}

function Kpi({
  label,
  value,
  href,
  note,
  tone,
  icon,
}: {
  label: string;
  value: number | string;
  href: string;
  note?: React.ReactNode;
  tone?: "danger";
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cardClass("raised-sm", "tile", "group block px-4 py-4 transition-[box-shadow,transform] sm:px-5 hover:-translate-y-0.5 hover:shadow-card")}
    >
      <StatTile
        label={<span className="group-hover:text-accent">{label}</span>}
        value={value}
        note={note}
        tone={tone}
        icon={
          <IconTile tone={tone === "danger" ? "soft" : "accent"} size="sm" className={tone === "danger" ? "text-danger!" : undefined}>
            {icon}
          </IconTile>
        }
      />
    </Link>
  );
}

/** Items due per week over the next five weeks, from the dashboard's upcoming list. */
function weeklyLoad(events: CalendarEvent[]) {
  const today = parseDate(todayISO());
  const buckets = Array.from({ length: 5 }, (_, w) => {
    const start = new Date(today);
    start.setDate(today.getDate() + w * 7);
    return { label: w === 0 ? "This week" : start.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), n: 0 };
  });
  for (const e of events) {
    const d = daysUntil(e.date);
    const w = Math.floor(Math.max(0, d) / 7);
    if (w < buckets.length) buckets[w].n += 1;
  }
  return buckets;
}

function Upcoming({ events }: { events: CalendarEvent[] }) {
  if (!events.length) {
    return (
      <EmptyState compact icon={<CalendarCheck2 size={22} />} title="Nothing due in the next 30 days">
        Deadlines, recurring filings and task due dates will show up here.
      </EmptyState>
    );
  }
  const load = weeklyLoad(events);
  return (
    <div>
      <div className="px-6 pb-3 pt-1">
        <AreaChart
          series={[{ label: "Items due", values: load.map((b) => b.n) }]}
          labels={load.map((b) => b.label)}
          height={92}
          ariaLabel="Items due per week over the next five weeks"
          formatValue={(v) => `${v} due`}
        />
      </div>
      <ol className="space-y-1 px-3 pb-4">
        {events.map((e, i) => {
          const href = eventHref(e);
          const d = parseDate(e.date);
          const days = daysUntil(e.date);
          const late = e.overdue || days < 0;
          const inner = (
            <>
              <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[15px] bg-surface-2">
                <span className="figure text-[17px] leading-none text-ink">{d.getDate()}</span>
                <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3">
                  {d.toLocaleString("en-IN", { month: "short" })}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[13px] leading-snug text-ink">{e.title}</span>
                <span className="mt-1 flex items-center gap-1.5 text-[11.5px] text-ink-3">
                  <EventKindIcon kind={e.kind} size={12} />
                  <span className="truncate">{eventSubtitle(e)}</span>
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1.5">
                {e.severity && <SeverityGlyph severity={e.severity} />}
                <Badge size="sm" tone={late ? "danger" : days <= 7 ? "accent" : "neutral"}>
                  {dueLabel(e.date)}
                </Badge>
              </span>
            </>
          );
          return (
            <li key={`${e.date}-${e.kind}-${e.task_id ?? e.obligation_id}-${i}`}>
              {href ? (
                <Link href={href} className="flex items-center gap-3.5 rounded-[18px] px-3 py-2.5 transition-colors hover:bg-surface-2">
                  {inner}
                </Link>
              ) : (
                <div className="flex items-center gap-3.5 px-3 py-2.5">{inner}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function alertHref(a: AlertOut): string | null {
  if (!a.ref_id) return null;
  if (a.ref_type === "obligation") return `/obligations?id=${a.ref_id}`;
  if (a.ref_type === "regulation") return `/regulations/${a.ref_id}`;
  if (a.ref_type === "task") return `/tasks?task=${a.ref_id}`;
  if (a.ref_type === "approval") return `/approvals?id=${a.ref_id}`;
  if (a.ref_type === "filing") return `/filings?filing=${a.ref_id}`;
  return null;
}

// Things that went wrong or need a decision get the red up-arrow; the rest the blue arrow.
const ATTENTION = new Set(["gap_found", "approval_escalated", "approval_rejected", "task_overdue"]);

function AlertBadge({ kind, severity }: { kind: string; severity: string }) {
  const urgent = ATTENTION.has(kind) || severity === "critical";
  return (
    <ArrowBadge
      direction={urgent ? "up" : "right"}
      tone={urgent ? "negative" : "primary"}
      label={urgent ? "Needs attention" : "For review"}
      className="mt-0.5"
    />
  );
}

function RecentAlerts() {
  // /api/alerts (not dashboard.recent_alerts) because only it carries ref_type/ref_id for linking.
  const q = useQuery<AlertOut[]>("alerts:recent", (signal) => api.alerts.list({ limit: 6 }, { signal }));
  if (q.error && !q.data) return <ErrorState compact error={q.error} onRetry={q.reload} />;
  if (!q.data) return <LoadingRows rows={4} />;
  if (!q.data.length)
    return (
      <EmptyState compact icon={<BellRing size={22} />} title="No alerts yet">
        Obligraph raises an alert when a new circular applies to you or an assessment finds a gap.
      </EmptyState>
    );
  return (
    <ul className="grid gap-1 px-3 pb-4 md:grid-cols-2">
      {q.data.map((a) => {
        const href = alertHref(a);
        const inner = (
          <>
            <AlertBadge kind={a.kind} severity={a.severity} />
            <span className="min-w-0 flex-1">
              <span className={clsx("line-clamp-2 text-[13px] leading-snug", a.read_at ? "text-ink-2" : "font-medium text-ink")}>{a.title}</span>
              <span className="mt-1 flex items-center gap-2 text-[11.5px] text-ink-3">
                {humanize(a.kind)} · {relativeTime(a.created_at)}
                {!a.read_at && (
                  <Badge size="sm" tone="accent">
                    Unread
                  </Badge>
                )}
              </span>
            </span>
          </>
        );
        return (
          <li key={a.id}>
            {href ? (
              <Link href={href} className="flex gap-3 rounded-[18px] px-3 py-2.5 transition-colors hover:bg-surface-2">
                {inner}
              </Link>
            ) : (
              <div className="flex gap-3 px-3 py-2.5">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]" role="status" aria-label="Loading dashboard">
      <Skeleton className="h-[300px] rounded-card" />
      <Skeleton className="h-[300px] rounded-card" />
      <Skeleton className="h-[340px] rounded-card" />
      <Skeleton className="h-[340px] rounded-card" />
    </div>
  );
}

export default function DashboardPage() {
  const { org } = useAuth();
  const { entity } = useVocab();
  const q = useQuery<Dashboard>("dashboard", (signal) => api.dashboard({ signal }));
  const d = q.data;

  const cov = d?.obligations.by_coverage ?? {};
  const gaps = (cov.missing ?? 0) + (cov.partial ?? 0);
  const status = d?.obligations.by_status ?? {};
  const taskTotal = d ? d.tasks.open + d.tasks.done : 0;

  return (
    <>
      <title>Dashboard · Obligraph</title>
      <PageHeader
        eyebrow={
          <>
            {org?.name}
            {org?.entity_classes.length ? ` · ${org.entity_classes.map(entity).join(", ")}` : ""} · As of {fmtDate(todayISO())}
          </>
        }
        title="Compliance position"
        description={
          d
            ? d.obligations.total
              ? `${d.obligations.total} obligations from ${d.regulations_tracked} regulation${d.regulations_tracked === 1 ? "" : "s"}. ${gaps} ${gaps === 1 ? "has" : "have"} an open gap (${cov.missing ?? 0} missing, ${cov.partial ?? 0} partial).`
              : "No obligations yet. Obligraph creates them from the regulations that apply to your entity types."
            : undefined
        }
      />

      {q.error && !d ? (
        <Panel>
          <ErrorState error={q.error} onRetry={q.reload} />
        </Panel>
      ) : !d ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <Panel
              title="Policy coverage"
              tab
              meta="How well your policies meet each obligation"
              actions={<PanelLink href="/obligations">All obligations</PanelLink>}
              bodyClassName="flex items-center"
            >
              <div className="flex flex-col items-center gap-6 px-6 pb-6 pt-2 sm:flex-row sm:items-center">
                <CoverageRing counts={cov} pct={d.coverage_pct} />
                <div className="w-full min-w-0 flex-1">
                  <CoverageLegend counts={cov} />
                  <p className="mt-3 px-3 text-[11.5px] leading-relaxed text-ink-3">
                    The arc counts a partial match as half; the inner ring splits every obligation by coverage. By status:{" "}
                    {(["open", "in_progress", "met", "not_applicable"] as const)
                      .filter((s) => (status[s] ?? 0) > 0)
                      .map((s) => `${status[s]} ${OBLIGATION_STATUS_LABEL[s].toLowerCase()}`)
                      .join(", ") || "none"}
                    .
                  </p>
                </div>
              </div>
            </Panel>

            <Panel title="Workload">
              <div className="grid grid-cols-2 gap-3 px-4 pt-1 sm:gap-4 sm:px-6">
                <Kpi
                  label="Open gaps"
                  value={gaps}
                  href="/obligations?coverage=gaps"
                  note={`${cov.missing ?? 0} missing · ${cov.partial ?? 0} partial`}
                  icon={<TriangleAlert size={15} />}
                />
                <Kpi label="Open tasks" value={d.tasks.open} href="/tasks" note={`${d.tasks.done} done`} icon={<SquareKanban size={15} />} />
                <Kpi
                  label="Overdue tasks"
                  value={d.tasks.overdue}
                  tone={d.tasks.overdue > 0 ? "danger" : undefined}
                  href="/tasks"
                  note={d.tasks.overdue > 0 ? "Past their due date" : "Nothing overdue"}
                  icon={<AlarmClock size={15} />}
                />
                <Kpi
                  label="Regulations tracked"
                  value={d.regulations_tracked}
                  href="/regulations?applies=1"
                  note="With obligations for you"
                  icon={<ScrollText size={15} />}
                />
              </div>
              <div className="px-7 pb-6 pt-6">
                <ProgressSlider
                  label="Tasks completed"
                  value={taskTotal ? (d.tasks.done / taskTotal) * 100 : 0}
                  caption={taskTotal ? `${d.tasks.done} of ${taskTotal} remediation tasks are done.` : "No remediation tasks yet."}
                />
              </div>
            </Panel>
          </div>

          <section aria-label="Filings and approvals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi
              label="Filings overdue"
              value={d.filings?.overdue ?? 0}
              tone={(d.filings?.overdue ?? 0) > 0 ? "danger" : undefined}
              href="/filings?status=overdue"
              note={(d.filings?.overdue ?? 0) > 0 ? "Past the regulator's due date" : "Nothing overdue"}
              icon={<FileStack size={15} />}
            />
            <Kpi
              label="Filings due in 30 days"
              value={d.filings?.due_30_days ?? 0}
              href="/filings?status=pending"
              note="Statutory returns coming up"
              icon={<CalendarCheck2 size={15} />}
            />
            <Kpi
              label="Approvals pending"
              value={d.approvals?.pending ?? 0}
              href="/approvals?view=all&status=pending"
              note="Waiting for a checker"
              icon={<Stamp size={15} />}
            />
            <Kpi
              label="Escalated approvals"
              value={d.approvals?.escalated ?? 0}
              tone={(d.approvals?.escalated ?? 0) > 0 ? "danger" : undefined}
              href="/approvals?view=all&status=pending"
              note={(d.approvals?.escalated ?? 0) > 0 ? "Past the decision SLA" : "None past the SLA"}
              icon={<ShieldAlert size={15} />}
            />
          </section>

          <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
            <Panel title="Risk heatmap" meta="Open gaps by severity">
              <RiskHeatmap byTopic={d.heatmap.by_topic} byRegulator={d.heatmap.by_regulator} />
            </Panel>
            <Panel title="Next 30 days" meta={d.upcoming.length ? `${d.upcoming.length} due` : undefined} actions={<PanelLink href="/calendar">Calendar</PanelLink>}>
              <Upcoming events={d.upcoming} />
            </Panel>
          </div>

          <Panel title="Recent alerts">
            <RecentAlerts />
          </Panel>
        </div>
      )}
    </>
  );
}
