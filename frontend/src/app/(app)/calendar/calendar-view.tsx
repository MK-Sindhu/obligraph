"use client";

import clsx from "clsx";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { CoverageGlyph, SeverityGlyph, sevColor } from "@/components/domain/badges";
import { EVENT_DONE_STATUSES, EVENT_KIND_LABEL, EventKindIcon, eventHref, eventSubtitle } from "@/components/domain/events";
import { Badge, Chip } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/ui/misc";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { api, type CalendarEvent } from "@/lib/api";
import { dueLabel, fmtDate, parseDate, toISODate, todayISO } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { useUrlState } from "@/lib/url-state";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const KINDS = ["deadline", "recurring", "task", "filing"] as const;
const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });

function parseMonth(v: string): Date {
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  const now = new Date();
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Monday-first grid covering the whole month. */
function gridDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7)));
  const days: Date[] = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d));
  return days;
}

function isOverdue(e: CalendarEvent, today: string): boolean {
  return e.overdue || (e.date < today && !EVENT_DONE_STATUSES.has(e.status));
}

/** Visual treatment per kind: deadlines solid, recurring filings dashed, tasks tinted. */
function EventChip({ e, today }: { e: CalendarEvent; today: string }) {
  const href = eventHref(e);
  const overdue = isOverdue(e, today);
  const done = EVENT_DONE_STATUSES.has(e.status);
  const cls = clsx(
    "flex w-full items-center gap-1 truncate rounded-[8px] py-[3px] pl-1.5 pr-1.5 text-left text-[11px] leading-tight",
    e.kind === "deadline" && "border-l-[3px] bg-surface-hi text-ink shadow-raised-xs",
    e.kind === "recurring" && "border border-dashed border-line-strong text-ink-2",
    e.kind === "task" && "bg-accent-wash text-ink",
    e.kind === "filing" && "border border-accent/35 bg-surface-hi text-ink",
    overdue && "outline outline-1 outline-[color:var(--danger)]",
    done && "opacity-55 line-through",
  );
  const style = e.kind === "deadline" ? { borderLeftColor: e.severity ? sevColor(e.severity) : "var(--ink-3)" } : undefined;
  const title = `${EVENT_KIND_LABEL[e.kind]}${overdue ? " (overdue)" : ""}: ${e.title}`;
  const inner = (
    <>
      <EventKindIcon kind={e.kind} size={11} className={e.kind === "task" || e.kind === "filing" ? "text-accent" : "text-ink-3"} />
      <span className="truncate">{e.title}</span>
    </>
  );
  return href ? (
    <Link href={href} className={clsx(cls, "hover:brightness-95")} style={style} title={title}>
      {inner}
    </Link>
  ) : (
    <span className={cls} style={style} title={title}>
      {inner}
    </span>
  );
}

function AgendaItem({ e, today }: { e: CalendarEvent; today: string }) {
  const href = eventHref(e);
  const overdue = isOverdue(e, today);
  const body = (
    <>
      <span
        className={clsx(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px]",
          e.kind === "deadline" && "bg-surface-2 text-ink-2 shadow-inset-sm",
          e.kind === "recurring" && "border border-dashed border-line-strong text-ink-3",
          e.kind === "task" && "bg-accent-grad-diag text-white shadow-glow-sm",
          e.kind === "filing" && "border border-accent/35 bg-surface-hi text-accent shadow-raised-xs",
        )}
      >
        <EventKindIcon kind={e.kind} size={13} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[13px] leading-snug text-ink">{e.title}</span>
        <span className="mt-0.5 block truncate text-[11.5px] text-ink-3">{eventSubtitle(e)}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="flex items-center gap-1.5">
          {e.coverage && <CoverageGlyph coverage={e.coverage} />}
          {e.severity && <SeverityGlyph severity={e.severity} />}
        </span>
        {overdue ? (
          <Badge size="sm" tone="danger">
            Overdue
          </Badge>
        ) : (
          <span className="text-[11px] text-ink-3">{dueLabel(e.date)}</span>
        )}
      </span>
    </>
  );
  return href ? (
    <Link href={href} className="flex gap-3 rounded-[18px] px-3 py-2.5 transition-colors hover:bg-surface-2">
      {body}
    </Link>
  ) : (
    <div className="flex gap-3 px-3 py-2.5">{body}</div>
  );
}

export function CalendarView() {
  const { get, set } = useUrlState();
  const month = parseMonth(get("month"));
  const selectedDay = get("day");
  const kindFilter = get("kind");
  const today = todayISO();

  const days = gridDays(month);
  const start = toISODate(days[0]);
  const end = toISODate(days[days.length - 1]);
  const q = useQuery<CalendarEvent[]>(`cal:${start}:${end}`, (signal) => api.calendar(start, end, { signal }));

  const events = (q.data ?? []).filter((e) => !kindFilter || e.kind === kindFilter);
  const byDate = new Map<string, CalendarEvent[]>();
  for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  const monthStart = toISODate(new Date(month.getFullYear(), month.getMonth(), 1));
  const monthEnd = toISODate(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const agenda = events.filter((e) => (selectedDay ? e.date === selectedDay : e.date >= monthStart && e.date <= monthEnd));
  const agendaDates = [...new Set(agenda.map((e) => e.date))].sort();
  const overdueCount = events.filter((e) => e.date >= monthStart && e.date <= monthEnd && isOverdue(e, today)).length;

  const shift = (n: number) => set({ month: monthKey(new Date(month.getFullYear(), month.getMonth() + n, 1)), day: null });

  return (
    <>
      <PageHeader
        eyebrow="Deadlines · recurring obligations · statutory filings · task due dates"
        title="Compliance calendar"
        actions={
          <div className="flex items-center gap-2">
            <IconButton label="Previous month" tone="soft" onClick={() => shift(-1)}>
              <ChevronLeft size={17} />
            </IconButton>
            <Button variant="secondary" onClick={() => set({ month: null, day: null })}>
              Today
            </Button>
            <IconButton label="Next month" tone="soft" onClick={() => shift(1)}>
              <ChevronRight size={17} />
            </IconButton>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="display flex items-center gap-3 text-[22px]" aria-live="polite">
          {monthFmt.format(month)}
          {overdueCount > 0 && (
            <Badge tone="danger" size="sm">
              {overdueCount} overdue
            </Badge>
          )}
        </h2>
        <div role="group" aria-label="Show event kinds" className="flex flex-wrap items-center gap-2">
          <Chip active={!kindFilter} onClick={() => set({ kind: null })}>
            All
          </Chip>
          {KINDS.map((k) => (
            <Chip
              key={k}
              active={kindFilter === k}
              onClick={() => set({ kind: kindFilter === k ? null : k })}
              icon={<EventKindIcon kind={k} size={12} />}
            >
              {EVENT_KIND_LABEL[k]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-card soft p-3 sm:p-5" aria-label={`${monthFmt.format(month)} calendar`}>
          {q.error && !q.data ? (
            <ErrorState error={q.error} onRetry={q.reload} />
          ) : (
            <div className={clsx(q.loading && "opacity-60 transition-opacity")}>
              <div className="mb-2 grid grid-cols-7 gap-1 rounded-full bg-surface-2 py-2 shadow-inset-sm sm:gap-2">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="text-center text-[11.5px] font-medium text-ink-3">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {days.map((d) => {
                  const iso = toISODate(d);
                  const inMonth = d.getMonth() === month.getMonth();
                  const list = byDate.get(iso) ?? [];
                  const isToday = iso === today;
                  const selected = iso === selectedDay;
                  const hasOverdue = list.some((e) => isOverdue(e, today));
                  return (
                    <div
                      key={iso}
                      className={clsx(
                        "relative min-h-[64px] rounded-[12px] p-1 sm:min-h-[112px] sm:rounded-[18px] sm:p-1.5",
                        inMonth ? "border border-[var(--card-edge)] bg-surface-grad shadow-raised-xs" : "border border-dashed border-line",
                        selected && "bg-accent-wash! bg-none! shadow-inset-sm! ring-2 ring-accent",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => set({ day: selected ? null : iso })}
                        aria-pressed={selected}
                        aria-label={`${fmtDate(iso)}: ${list.length} item${list.length === 1 ? "" : "s"}${selected ? ", selected" : ""}`}
                        className={clsx(
                          "num mb-1 inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[12px]",
                          isToday
                            ? "bg-accent-grad-diag font-semibold text-white shadow-glow-sm"
                            : inMonth
                              ? "font-medium text-ink hover:bg-surface-2"
                              : "text-ink-3 hover:bg-surface-2",
                        )}
                      >
                        {d.getDate()}
                      </button>
                      {/* Compact dots on phones, chips from sm up */}
                      {list.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden="true">
                          {list.slice(0, 4).map((e, j) => (
                            <span
                              key={j}
                              className={clsx("h-1.5 w-1.5 rounded-full", e.kind === "recurring" && "border border-ink-3 bg-transparent")}
                              style={
                                e.kind === "recurring"
                                  ? undefined
                                  : { background: e.kind === "task" || e.kind === "filing" ? "var(--accent)" : sevColor(e.severity ?? "") }
                              }
                            />
                          ))}
                        </div>
                      )}
                      <div className="hidden space-y-0.5 sm:block">
                        {list.slice(0, 3).map((e, j) => (
                          <EventChip key={`${e.kind}-${e.task_id ?? e.obligation_id}-${j}`} e={e} today={today} />
                        ))}
                        {list.length > 3 && (
                          <button type="button" onClick={() => set({ day: iso })} className="rounded-full px-1.5 text-[11px] font-medium text-accent hover:underline">
                            +{list.length - 3} more
                          </button>
                        )}
                      </div>
                      {hasOverdue && <span className="absolute right-2 top-2.5 h-2 w-2 rounded-full bg-danger" title="Has overdue items" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <Panel
          title={selectedDay ? fmtDate(selectedDay) : "Agenda"}
          meta={q.data ? `${agenda.length} item${agenda.length === 1 ? "" : "s"}` : undefined}
          actions={
            selectedDay ? (
              <button type="button" onClick={() => set({ day: null })} className="rounded-full text-[12.5px] font-medium text-accent hover:underline">
                Whole month
              </button>
            ) : undefined
          }
          className="xl:sticky xl:top-[92px]"
        >
          {q.error && !q.data ? (
            <ErrorState compact error={q.error} onRetry={q.reload} />
          ) : !q.data ? (
            <LoadingRows rows={5} />
          ) : agenda.length === 0 ? (
            <EmptyState compact icon={<CalendarDays size={22} />} title={selectedDay ? "Nothing due on this day" : "Nothing due this month"}>
              {selectedDay ? "Pick another day, or view the whole month." : "Use the arrows to look ahead. Deadlines appear once regulations with due dates apply to you."}
            </EmptyState>
          ) : (
            <div className="max-h-[70dvh] overflow-y-auto px-3 pb-4">
              {agendaDates.map((date) => {
                const d = parseDate(date);
                return (
                  <div key={date}>
                    <p
                      className={clsx(
                        "sticky top-0 z-[1] mt-2 rounded-full bg-surface-2 px-4 py-1.5 text-[11.5px] font-medium shadow-inset-sm first:mt-0",
                        date === today ? "text-accent" : "text-ink-3",
                      )}
                    >
                      {d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                      {date === today && " · Today"}
                    </p>
                    <ul className="mt-1">
                      {agenda
                        .filter((e) => e.date === date)
                        .map((e, j) => (
                          <li key={`${e.kind}-${e.task_id ?? e.obligation_id}-${j}`}>
                            <AgendaItem e={e} today={today} />
                          </li>
                        ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
