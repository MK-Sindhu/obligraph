"use client";

import clsx from "clsx";
import { CalendarClock, ExternalLink, FileCheck2, FileStack, Paperclip, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { RegulatorTag } from "@/components/domain/badges";
import { Badge, Chip } from "@/components/ui/badge";
import { Button, IconTile } from "@/components/ui/button";
import { softCardClass } from "@/components/ui/card";
import { PageHeader, Panel, SegmentedControl } from "@/components/ui/misc";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { api, type FilingOut, type FilingStatus, type ReturnTypeOut } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { daysUntil, dueLabel, fmtDate, todayISO } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { useUrlState } from "@/lib/url-state";
import { useVocab } from "@/lib/vocab";
import {
  FilingDialog,
  FilingStatusChip,
  FREQ_LABEL,
  periodLabel,
  ReturnDialog,
  SampleBadge,
  type FilingMode,
} from "./filing-parts";

const STATUSES: FilingStatus[] = ["pending", "overdue", "filed", "late", "waived"];
type Range = "window" | "fy" | "lastfy";

/** Indian financial year (April–March) containing `d`, shifted by `offset` years. */
function fyRange(offset = 0): { start: string; end: string; label: string } {
  const now = new Date();
  const startYear = (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1) + offset;
  return { start: `${startYear}-04-01`, end: `${startYear + 1}-03-31`, label: `FY ${startYear}-${String(startYear + 1).slice(2)}` };
}

function FilingsTable({
  rows,
  onOpen,
  canFile,
}: {
  rows: FilingOut[];
  onOpen: (f: FilingOut, mode: FilingMode) => void;
  canFile: boolean;
}) {
  return (
    <div className="overflow-x-auto px-3 pb-3">
      <table className="w-full min-w-[860px] text-[13px]">
        <thead>
          <tr className="text-left text-[11.5px] text-ink-3 [&>th]:font-medium">
            <th className="px-4 py-2">Return</th>
            <th className="px-3 py-2">Period</th>
            <th className="px-3 py-2">Due</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Filed</th>
            <th className="px-3 py-2 text-right" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => {
            const open = f.status === "pending" || f.status === "overdue";
            const days = daysUntil(f.due_on);
            return (
              <tr key={f.id} className="border-t border-line align-middle transition-colors hover:bg-surface-2">
                <td className="px-4 py-3">
                  <button type="button" onClick={() => onOpen(f, "details")} className="group block rounded-[10px] text-left">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <RegulatorTag regulator={f.regulator} />
                      <span className="font-mono text-[10.5px] text-ink-3">{f.code}</span>
                      {f.sample && <SampleBadge />}
                    </span>
                    <span className="mt-1 block font-medium text-ink group-hover:text-accent group-hover:underline">{f.name}</span>
                  </button>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-ink-2">
                  {periodLabel(f)}
                  <span className="block text-[11.5px] text-ink-3">{FREQ_LABEL[f.frequency]}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  <span className="text-ink">{fmtDate(f.due_on)}</span>
                  {open && (
                    <span className={clsx("block text-[11.5px]", days < 0 ? "font-medium text-danger" : days <= 7 ? "text-accent" : "text-ink-3")}>
                      {dueLabel(f.due_on)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <FilingStatusChip status={f.status} size="sm" />
                </td>
                <td className="px-3 py-3 text-ink-2">
                  {f.filed_on ? (
                    <>
                      {fmtDate(f.filed_on)}
                      {f.reference && <span className="block font-mono text-[11px] text-ink-3">{f.reference}</span>}
                    </>
                  ) : f.status === "waived" ? (
                    <span className="text-ink-3">Waived</span>
                  ) : (
                    <span className="text-ink-3">—</span>
                  )}
                  {(f.evidence?.length ?? 0) > 0 && (
                    <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-ink-3">
                      <Paperclip size={11} aria-hidden="true" /> {f.evidence?.length} file{f.evidence?.length === 1 ? "" : "s"}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right">
                  {open && canFile ? (
                    <Button size="sm" variant={f.status === "overdue" ? "primary" : "secondary"} icon={<FileCheck2 size={13} />} onClick={() => onOpen(f, "file")}>
                      Mark as filed
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => onOpen(f, "details")}>
                      Details
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReturnsCatalogue({ onEdit }: { onEdit: (r: ReturnTypeOut | null) => void }) {
  const { can } = useAuth();
  const { entity } = useVocab();
  const q = useQuery<ReturnTypeOut[]>("returns", (signal) => api.returns.list({ signal }));
  const items = q.data ?? [];
  if (q.error != null && !q.data) return <Panel><ErrorState error={q.error} onRetry={q.reload} /></Panel>;
  if (!q.data) return <Panel><LoadingRows rows={4} label="Loading returns" /></Panel>;
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {items.map((r) => (
        <article key={r.id} className={softCardClass("raised", "tile", clsx("flex flex-col px-5 py-5", !r.active && "opacity-70"))}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <RegulatorTag regulator={r.regulator} />
              <span className="font-mono text-[10.5px] text-ink-3">{r.code}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {r.sample && <SampleBadge />}
              {r.custom && <Badge size="sm" tone="accent">Custom</Badge>}
              {!r.active && <Badge size="sm" tone="dashed">Inactive</Badge>}
            </div>
          </div>
          <h3 className="display mt-3 text-[15.5px] leading-snug text-ink">{r.name}</h3>
          <p className="mt-1 text-[12.5px] text-ink-2">
            {FREQ_LABEL[r.frequency]} · due {r.due_days} day{r.due_days === 1 ? "" : "s"} after period end
          </p>
          {r.description && (
            <p className={clsx("mt-3 rounded-[14px] px-3.5 py-2.5 text-[12px] leading-relaxed", r.sample ? "bg-[var(--sev-medium-bg)] text-warn" : "bg-surface-2 text-ink-2 shadow-inset-sm")}>
              {r.description}
            </p>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-4 text-[12px] text-ink-3">
            {r.next_due_on && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock size={12} aria-hidden="true" /> Next due {fmtDate(r.next_due_on)}
              </span>
            )}
            {(r.entity_classes.length > 0 || r.layers.length > 0) && (
              <span>
                For {[...r.entity_classes.map(entity), ...r.layers.map((l) => `${l} layer`)].join(", ")}
              </span>
            )}
            {r.portal && (
              <a href={r.portal} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full text-accent hover:underline">
                Portal <ExternalLink size={11} aria-hidden="true" />
              </a>
            )}
            <span className="flex-1" />
            {can("admin") && r.custom && (
              <Button size="sm" variant="ghost" icon={<Pencil size={13} />} onClick={() => onEdit(r)}>
                Edit
              </Button>
            )}
          </div>
        </article>
      ))}
      {can("admin") && (
        <button
          type="button"
          onClick={() => onEdit(null)}
          className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-tile border-2 border-dashed border-line-strong text-[13px] font-medium text-ink-2 transition-colors hover:border-accent/50 hover:text-accent"
        >
          <IconTile tone="accent" size="md">
            <Plus size={18} />
          </IconTile>
          Add a custom return
        </button>
      )}
    </div>
  );
}

export function FilingsView() {
  const { can } = useAuth();
  const { get, set } = useUrlState();
  const tab = get("tab") === "returns" ? "returns" : "filings";
  const status = get("status") as FilingStatus | "";
  const range = (get("range") || "window") as Range;
  const filingParam = get("filing");

  const fy = range === "fy" ? fyRange(0) : range === "lastfy" ? fyRange(-1) : null;
  const key = `filings:${range}:${status}`;
  const q = useQuery<FilingOut[]>(range === "window" && !status ? "filings:default" : key, (signal) =>
    api.filings.list({ start: fy?.start, end: fy?.end, status: status || undefined }, { signal }),
  );
  const rows = [...(q.data ?? [])].sort((a, b) => (a.due_on < b.due_on ? 1 : a.due_on > b.due_on ? -1 : a.name.localeCompare(b.name)));

  const [dialog, setDialog] = useState<{ filing: FilingOut; mode: FilingMode } | null>(null);
  const [returnEdit, setReturnEdit] = useState<{ open: boolean; existing: ReturnTypeOut | null }>({ open: false, existing: null });
  const [returnsNonce, setReturnsNonce] = useState(0);

  // Deep link (?filing=…) from the calendar, alerts or the evidence register.
  const linked = filingParam ? q.data?.find((x) => x.id === filingParam) : undefined;
  const current = dialog ?? (linked ? { filing: linked, mode: "details" as FilingMode } : null);

  const all = q.data ?? [];
  const today = todayISO();
  const stats = {
    overdue: all.filter((f) => f.status === "overdue").length,
    due30: all.filter((f) => f.status === "pending" && daysUntil(f.due_on) >= 0 && daysUntil(f.due_on) <= 30).length,
    filed: all.filter((f) => f.status === "filed").length,
    late: all.filter((f) => f.status === "late").length,
  };

  function update(f: FilingOut) {
    q.setData((prev) => (prev ?? []).map((x) => (x.id === f.id ? f : x)));
    q.reload();
  }

  return (
    <>
      <PageHeader
        eyebrow="Statutory returns"
        title="Filings"
        description="Every periodic return your organisation owes, period by period, with what was filed, when, and the acknowledgement that proves it."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Tabs
          label="Filings views"
          idPrefix="filings"
          value={tab}
          onChange={(v) => set({ tab: v === "returns" ? "returns" : null, status: null })}
          tabs={[
            {
              value: "filings",
              label: (
                <>
                  <FileStack size={14} aria-hidden="true" /> Filings
                </>
              ),
            },
            { value: "returns", label: "Returns catalogue" },
          ]}
        />
        {tab === "filings" && (
          <SegmentedControl<Range>
            label="Period"
            size="sm"
            value={range}
            onChange={(v) => set({ range: v === "window" ? null : v })}
            options={[
              { value: "window", label: "Recent and upcoming" },
              { value: "fy", label: fyRange(0).label },
              { value: "lastfy", label: fyRange(-1).label },
            ]}
          />
        )}
      </div>

      <div role="tabpanel" id={`filings-panel-${tab}`} aria-labelledby={`filings-tab-${tab}`}>
        {tab === "returns" ? (
          <ReturnsCatalogue key={returnsNonce} onEdit={(r) => setReturnEdit({ open: true, existing: r })} />
        ) : (
          <>
            {q.data && (
              <p className="mb-5 flex flex-wrap items-center gap-2.5 text-[12.5px] text-ink-2 [&>span]:inline-flex [&>span]:h-9 [&>span]:items-center [&>span]:gap-1.5 [&>span]:rounded-full [&>span]:px-4">
                <span className={stats.overdue ? "soft-xs text-danger" : "soft-xs"}>
                  <span className="num figure text-[15px]">{stats.overdue}</span> overdue
                </span>
                <span className="soft-xs">
                  <span className="num figure text-[15px] text-ink">{stats.due30}</span> due in 30 days
                </span>
                <span className="soft-xs">
                  <span className="num figure text-[15px] text-ink">{stats.filed}</span> filed on time
                </span>
                <span className="soft-xs">
                  <span className="num figure text-[15px] text-ink">{stats.late}</span> filed late
                </span>
              </p>
            )}
            <div role="group" aria-label="Filter by status" className="mb-5 flex flex-wrap gap-2">
              <Chip active={!status} onClick={() => set({ status: null })}>
                All
              </Chip>
              {STATUSES.map((s) => (
                <Chip key={s} active={status === s} onClick={() => set({ status: status === s ? null : s })}>
                  {s === "late" ? "Filed late" : s[0].toUpperCase() + s.slice(1)}
                </Chip>
              ))}
            </div>
            <Panel
              title={fy ? fy.label : "Filings"}
              meta={q.data ? `${rows.length} filing${rows.length === 1 ? "" : "s"}${q.loading ? " · updating…" : ""} · as of ${fmtDate(today)}` : undefined}
            >
              {q.error != null && !q.data ? (
                <ErrorState error={q.error} onRetry={q.reload} />
              ) : !q.data ? (
                <LoadingRows rows={6} label="Loading filings" />
              ) : rows.length === 0 ? (
                <EmptyState icon={<FileStack size={22} />} title={status ? "No filings with this status" : "No filings in this period"}>
                  Filings are scheduled from the returns catalogue for each period that applies to your entity types.
                </EmptyState>
              ) : (
                <FilingsTable rows={rows} canFile={can("member")} onOpen={(f, mode) => setDialog({ filing: f, mode })} />
              )}
            </Panel>
          </>
        )}
      </div>

      <FilingDialog
        filing={current?.filing ?? null}
        mode={current?.mode ?? "details"}
        onMode={(mode) => current && setDialog({ filing: current.filing, mode })}
        onClose={() => {
          setDialog(null);
          if (filingParam) set({ filing: null });
        }}
        onChange={update}
      />
      <ReturnDialog
        open={returnEdit.open}
        existing={returnEdit.existing}
        onClose={() => setReturnEdit({ open: false, existing: null })}
        onSaved={() => setReturnsNonce((n) => n + 1)}
      />
    </>
  );
}
