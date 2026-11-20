"use client";

import clsx from "clsx";
import {
  AlarmClock,
  Download,
  FileArchive,
  FileDown,
  FileSpreadsheet,
  Printer,
  ScrollText,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useState } from "react";
import { CoverageBadge, SEVERITIES, SeverityBadge, SeverityGlyph } from "@/components/domain/badges";
import { Badge, Chip } from "@/components/ui/badge";
import { Button, IconTile } from "@/components/ui/button";
import { softCardClass, StatTile } from "@/components/ui/card";
import { AreaChart, DonutGauge } from "@/components/ui/charts";
import { Input, Label } from "@/components/ui/field";
import { PageHeader, Panel } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, type BoardPack, type CoverageRow } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { downloadFile, saveBlob } from "@/lib/download";
import { fmtDate, fmtDateTime, fmtShortDate, humanize, toISODate, todayISO } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { useUrlState } from "@/lib/url-state";

type Preset = "qtd" | "lastq" | "fytd" | "30d";

function presetRange(p: Preset): { start: string; end: string } {
  const now = new Date();
  const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
  if (p === "qtd") return { start: toISODate(new Date(now.getFullYear(), qStartMonth, 1)), end: todayISO() };
  if (p === "lastq") {
    const s = new Date(now.getFullYear(), qStartMonth - 3, 1);
    return { start: toISODate(s), end: toISODate(new Date(s.getFullYear(), s.getMonth() + 3, 0)) };
  }
  if (p === "fytd") {
    const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return { start: `${y}-04-01`, end: todayISO() };
  }
  const s = new Date(now);
  s.setDate(s.getDate() - 30);
  return { start: toISODate(s), end: todayISO() };
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: "qtd", label: "Quarter to date" },
  { value: "lastq", label: "Last quarter" },
  { value: "fytd", label: "Financial year to date" },
  { value: "30d", label: "Last 30 days" },
];

const DATASETS: { key: string; label: string; note: string }[] = [
  { key: "obligations", label: "Obligations", note: "Coverage, status, owner" },
  { key: "tasks", label: "Tasks", note: "Remediation work and due dates" },
  { key: "approvals", label: "Approvals", note: "Maker, checker, decision" },
  { key: "evidence", label: "Evidence", note: "Files with SHA-256" },
  { key: "filings", label: "Filings", note: "Periods, due and filed dates" },
  { key: "activity", label: "Activity log", note: "Who changed what" },
  { key: "policies", label: "Policies", note: "Uploaded documents" },
];

function CoverageTable({ rows, caption, keyLabel }: { rows: CoverageRow[]; caption: string; keyLabel: string }) {
  if (!rows.length) return <p className="px-6 pb-6 text-[13px] text-ink-3">No obligations to break down.</p>;
  return (
    <div className="overflow-x-auto px-3 pb-3">
      <table className="w-full min-w-[460px] text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-left text-[11.5px] text-ink-3 [&>th]:font-medium">
            <th className="px-3 py-2">{keyLabel}</th>
            <th className="px-2 py-2 text-right">Covered</th>
            <th className="px-2 py-2 text-right">Partial</th>
            <th className="px-2 py-2 text-right">Missing</th>
            <th className="w-[34%] px-3 py-2">Coverage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line">
              <td className="px-3 py-2.5 text-ink">{r.key}</td>
              <td className="num px-2 py-2.5 text-right" style={{ color: "var(--cov-covered-ink)" }}>
                {r.covered ?? 0}
              </td>
              <td className="num px-2 py-2.5 text-right" style={{ color: "var(--cov-partial-ink)" }}>
                {r.partial ?? 0}
              </td>
              <td className="num px-2 py-2.5 text-right" style={{ color: "var(--cov-missing-ink)" }}>
                {r.missing ?? 0}
              </td>
              <td className="px-3 py-2.5">
                <span className="flex items-center gap-2.5">
                  <ProgressBar value={r.coverage_pct ?? 0} className="flex-1" />
                  <span className="num w-10 text-right text-[12px] font-medium text-ink">{r.coverage_pct === null ? "—" : `${Math.round(r.coverage_pct)}%`}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BoardPackBody({ d }: { d: BoardPack }) {
  const h = d.headline;
  const trend = d.trend.filter((t) => t.coverage_pct !== null);
  const ageMax = Math.max(1, ...d.gap_aging.flatMap((b) => SEVERITIES.map((s) => b[s] ?? 0)));
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <section className={softCardClass("raised", "md", "flex flex-col items-center px-6 py-6")} aria-label="Coverage">
          <DonutGauge
            value={h.coverage_pct}
            size={184}
            thickness={16}
            label={`Policy coverage ${h.coverage_pct === null ? "not available" : `${Math.round(h.coverage_pct)}%`}`}
            centerCaption="coverage"
            segments={(["covered", "partial", "missing", "unassessed"] as const).map((k) => ({
              key: k,
              value: h.by_coverage[k] ?? 0,
              color: `var(--cov-${k})`,
              label: humanize(k),
            }))}
          />
          <p className="mt-4 text-center text-[12.5px] text-ink-2">
            {h.obligations} applicable obligations · {d.org.name}
            {d.org.sbr_layer ? ` · ${humanize(d.org.sbr_layer)} layer` : ""}
          </p>
        </section>
        <section className={softCardClass("raised", "md", "px-7 py-6")} aria-label="Summary">
          <p className="text-[12px] font-medium text-accent">For the board · {d.period.label}</p>
          <h2 className="display mt-1.5 text-[20px] text-ink">Compliance summary</h2>
          <div className="mt-3 space-y-2.5 text-[14px] leading-relaxed text-ink-2">
            {d.narrative.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <p className="mt-4 text-[11.5px] text-ink-3">Generated {fmtDateTime(d.generated_at)}</p>
        </section>
      </div>

      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {[
          { label: "Open gaps", value: h.open_gaps, note: `${h.critical_high_gaps} critical or high`, icon: <TriangleAlert size={15} />, danger: h.critical_high_gaps > 0 },
          { label: "Overdue tasks", value: h.overdue_tasks, note: h.overdue_tasks ? "Past their due date" : "Nothing overdue", icon: <AlarmClock size={15} />, danger: h.overdue_tasks > 0 },
          { label: "Pending approvals", value: h.pending_approvals, note: `${h.escalated_approvals} escalated`, icon: <ShieldCheck size={15} />, danger: false },
          {
            label: "Filings filed",
            value: h.filings.filed ?? 0,
            note: `${h.filings.overdue ?? 0} overdue${h.filings.late ? ` · ${h.filings.late} late` : ""}`,
            icon: <ScrollText size={15} />,
            danger: (h.filings.overdue ?? 0) > 0,
          },
        ].map((k) => (
          <div key={k.label} className={softCardClass("raised-sm", "tile", "px-5 py-4")}>
            <StatTile
              label={k.label}
              value={k.value}
              note={<span className={k.danger ? "font-medium text-danger" : undefined}>{k.note}</span>}
              icon={
                <IconTile tone="accent" size="sm">
                  {k.icon}
                </IconTile>
              }
            />
          </div>
        ))}
      </div>

      <Panel title="Coverage trend" meta={trend.length > 1 ? `${trend.length} daily snapshots` : undefined}>
        <div className="px-6 pb-6">
          {trend.length > 1 ? (
            <AreaChart
              series={[{ label: "Coverage", values: trend.map((t) => t.coverage_pct ?? 0) }]}
              labels={trend.map((t, i) => (i === 0 || i === trend.length - 1 || i % Math.ceil(trend.length / 6) === 0 ? fmtShortDate(t.day) : ""))}
              height={150}
              highlight={trend.length - 1}
              ariaLabel="Policy coverage per day in the period"
              formatValue={(v) => `${Math.round(v)}%`}
            />
          ) : (
            <p className="rounded-[18px] bg-surface-2 px-4 py-3 text-[13px] text-ink-3 shadow-inset-sm">
              {trend.length === 1
                ? `One snapshot so far (${fmtDate(trend[0].day)}: ${Math.round(trend[0].coverage_pct ?? 0)}%). The trend line appears once Obligraph has taken daily snapshots on more than one day in the period.`
                : "No coverage snapshots in this period yet."}
            </p>
          )}
        </div>
      </Panel>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel title="Coverage by regulator">
          <CoverageTable rows={d.by_regulator} caption="Coverage by regulator" keyLabel="Regulator" />
        </Panel>
        <Panel title="Coverage by topic">
          <CoverageTable rows={d.by_topic} caption="Coverage by topic" keyLabel="Topic" />
        </Panel>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Panel title="Gap ageing" meta="Open gaps by how long they've been open">
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full min-w-[380px] table-fixed border-separate border-spacing-[5px] text-[13px]">
              <thead>
                <tr>
                  <th className="pb-1 text-left text-[11.5px] font-medium text-ink-3">Open for</th>
                  {SEVERITIES.map((s) => (
                    <th key={s} className="pb-1 text-center text-[11.5px] font-medium text-ink-2">
                      <span className="inline-flex items-center gap-1">
                        <SeverityGlyph severity={s} />
                        {humanize(s)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.gap_aging.map((b) => (
                  <tr key={b.bucket}>
                    <th scope="row" className="pr-2 text-left text-[12.5px] font-normal text-ink">
                      {b.bucket}
                    </th>
                    {SEVERITIES.map((s) => {
                      const n = b[s] ?? 0;
                      const l = n ? Math.min(5, Math.max(1, Math.ceil((n / ageMax) * 5))) : 0;
                      return (
                        <td key={s} className="p-0">
                          <span
                            className={clsx("num flex h-9 items-center justify-center rounded-[11px] text-[13px]", n ? "font-semibold shadow-raised-xs" : "shadow-inset-sm")}
                            style={{ background: `var(--heat-${l})`, color: `var(--heat-fg-${l})` }}
                          >
                            {n || "·"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Critical and high gaps" meta={`${d.critical_gaps.length}`}>
          {d.critical_gaps.length ? (
            <ul className="space-y-1 px-3 pb-4">
              {d.critical_gaps.map((g, i) => (
                <li key={i} className="flex items-start gap-3 rounded-[18px] px-3 py-2.5">
                  <SeverityBadge severity={g.severity} className="mt-0.5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[13px] leading-snug text-ink">{g.requirement}</span>
                    <span className="mt-1 block text-[11.5px] text-ink-3">
                      <span className="font-mono text-[10.5px]">{g.ref_no ?? g.regulation}</span> · open {g.age_days} day{g.age_days === 1 ? "" : "s"}
                    </span>
                  </span>
                  <CoverageBadge coverage={g.coverage} className="shrink-0" />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title="No critical or high gaps">
              Nothing rated critical or high is missing or partial.
            </EmptyState>
          )}
        </Panel>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Ownership" meta="Open obligations by owner" icon={<IconTile tone="soft" size="sm"><Users size={15} /></IconTile>}>
          <ul className="space-y-3 px-6 pb-6">
            {d.ownership.map((o) => (
              <li key={o.owner}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
                  <span className={o.owner === "Unassigned" ? "text-danger" : "text-ink"}>{o.owner}</span>
                  <span className="num text-ink-2">
                    {o.open} · {Math.round(o.share_pct)}%
                  </span>
                </div>
                <ProgressBar value={o.share_pct} color={o.owner === "Unassigned" ? "var(--cov-missing)" : undefined} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Readiness packs">
          <ul className="space-y-3 px-6 pb-6">
            {d.packs.map((p) => (
              <li key={p.name}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="text-ink">{p.name}</span>
                  <span className="num font-medium text-ink">{p.readiness_pct === null ? "—" : `${Math.round(p.readiness_pct)}%`}</span>
                </div>
                <ProgressBar value={p.readiness_pct ?? 0} />
                <p className="mt-1 text-[11.5px] text-ink-3">{p.obligations} obligations</p>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Approvals in the period">
          <div className="grid grid-cols-3 gap-3 px-6 pb-6">
            {(["approved", "rejected", "pending"] as const).map((k) => (
              <div key={k} className="rounded-[18px] bg-surface-2 px-3 py-3 text-center shadow-inset-sm">
                <p className="figure text-[24px] leading-none text-ink">{d.approvals[k]}</p>
                <p className="mt-1.5 text-[11.5px] text-ink-3">{humanize(k)}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Panel title="Missed or late filings" meta={`${d.filings_missed.length}`}>
          {d.filings_missed.length ? (
            <ul className="space-y-1 px-3 pb-4">
              {d.filings_missed.map((f, i) => (
                <li key={i} className="flex items-center gap-3 rounded-[16px] px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-ink">{f.name}</span>
                    <span className="text-[11.5px] text-ink-3">Due {fmtDate(f.due_on)}</span>
                  </span>
                  <Badge size="sm" tone={f.status === "overdue" ? "danger" : "warn"}>
                    {f.status === "late" ? "Filed late" : humanize(f.status)}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 pb-6 text-[13px] text-ink-3">Every filing in the period was made on time.</p>
          )}
        </Panel>
        <Panel title="New regulations" meta={`${d.new_regulations.length}`}>
          {d.new_regulations.length ? (
            <ul className="space-y-1 px-3 pb-4">
              {d.new_regulations.map((r, i) => (
                <li key={i} className="rounded-[16px] px-3 py-2">
                  <span className="block text-[13px] text-ink">{r.title}</span>
                  <span className="font-mono text-[10.5px] text-ink-3">{[r.regulator, r.ref_no, r.issued_on && fmtDate(r.issued_on)].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 pb-6 text-[13px] text-ink-3">No new instruments applied to you in the period.</p>
          )}
        </Panel>
        <Panel title="Superseded instruments" meta={`${d.superseded.length}`}>
          {d.superseded.length ? (
            <ul className="space-y-1 px-3 pb-4">
              {d.superseded.map((r, i) => (
                <li key={i} className="rounded-[16px] px-3 py-2">
                  <span className="block text-[13px] text-ink">{r.title}</span>
                  <span className="font-mono text-[10.5px] text-ink-3">{[r.regulator, r.ref_no].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 pb-6 text-[13px] text-ink-3">Nothing was superseded in the period.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Exports() {
  const { can } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function get(path: string, filename: string, key: string) {
    setBusy(key);
    try {
      const r = await downloadFile(path, { filename });
      toast.success("Download ready", r.filename);
    } catch (e) {
      toast.error("Couldn't export", errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel
      title="Exports"
      meta="CSV for spreadsheets and auditors"
      icon={
        <IconTile tone="accent" size="sm">
          <FileSpreadsheet size={15} />
        </IconTile>
      }
    >
      <div className="px-6 pb-6">
        {!can("member") ? (
          <p className="text-[13px] text-ink-3">Exports are available to members, admins and owners.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {DATASETS.map((ds) => (
              <li key={ds.key}>
                <button
                  type="button"
                  onClick={() => get(`/exports/${ds.key}.csv`, `${ds.key}.csv`, ds.key)}
                  disabled={busy !== null}
                  className="flex w-full items-center gap-3 rounded-[20px] px-4 py-3 text-left soft-xs transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-raised-sm disabled:opacity-60"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-surface-2 text-accent shadow-inset-sm">
                    {busy === ds.key ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" /> : <Download size={15} aria-hidden="true" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-ink">{ds.label}.csv</span>
                    <span className="block truncate text-[11.5px] text-ink-3">{ds.note}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-[22px] bg-surface-2 px-5 py-4 shadow-inset-sm">
          <IconTile tone="accent" size="md">
            <FileArchive size={18} />
          </IconTile>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium text-ink">Audit pack</p>
            <p className="text-[12px] text-ink-2">Every export above, the evidence files and their hashes, in one .zip for the auditor.</p>
          </div>
          {can("admin") ? (
            <Button
              variant="primary"
              icon={<FileDown size={14} />}
              loading={busy === "audit"}
              disabled={busy !== null && busy !== "audit"}
              onClick={() => get("/exports/audit-pack.zip", "audit-pack.zip", "audit")}
            >
              Audit pack (.zip)
            </Button>
          ) : (
            <span className="text-[12px] text-ink-3">Admins and owners only</span>
          )}
        </div>
      </div>
    </Panel>
  );
}

export function ReportsView() {
  const toast = useToast();
  const { get, set } = useUrlState();
  const preset = (get("preset") || (get("start") ? "" : "qtd")) as Preset | "";
  const range = preset ? presetRange(preset) : { start: get("start"), end: get("end") };
  const [printing, setPrinting] = useState<"print" | "html" | null>(null);

  const q = useQuery<BoardPack>(`board:${range.start}:${range.end}`, (signal) =>
    api.reports.boardPack({ start: range.start || undefined, end: range.end || undefined }, { signal }),
  );
  const d = q.data;

  async function printPack() {
    // Open the window inside the click so pop-up blockers allow it; fill it once the HTML arrives.
    const w = window.open("", "_blank");
    setPrinting("print");
    try {
      const html = await api.reports.boardPackHtml({ start: range.start || undefined, end: range.end || undefined });
      if (!w) {
        saveBlob(new Blob([html], { type: "text/html" }), `board-pack-${range.start}-${range.end}.html`);
        toast.toast({ title: "Pop-up blocked", body: "Downloaded the board pack as .html instead. Open it and print to PDF." });
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      window.setTimeout(() => w.print(), 400);
    } catch (e) {
      w?.close();
      toast.error("Couldn't build the printable board pack", errorMessage(e));
    } finally {
      setPrinting(null);
    }
  }

  async function downloadHtml() {
    setPrinting("html");
    try {
      const html = await api.reports.boardPackHtml({ start: range.start || undefined, end: range.end || undefined });
      saveBlob(new Blob([html], { type: "text/html" }), `board-pack-${range.start || "start"}-${range.end || "end"}.html`);
    } catch (e) {
      toast.error("Couldn't download the board pack", errorMessage(e));
    } finally {
      setPrinting(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Reporting"
        title="Board pack and exports"
        description="A one-page compliance summary for the board for any period, plus CSV exports and the audit pack."
        actions={
          <>
            <Button variant="secondary" icon={<FileDown size={14} />} loading={printing === "html"} disabled={!d} onClick={downloadHtml}>
              Download .html
            </Button>
            <Button variant="primary" icon={<Printer size={14} />} loading={printing === "print"} disabled={!d} onClick={printPack}>
              Print / Save as PDF
            </Button>
          </>
        }
      />

      <section className={softCardClass("raised-sm", "tile", "mb-6 flex flex-wrap items-end gap-x-5 gap-y-4 px-5 py-4")} aria-label="Reporting period">
        <div role="group" aria-label="Period presets" className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Chip key={p.value} active={preset === p.value} onClick={() => set({ preset: p.value === "qtd" ? null : p.value, start: null, end: null })}>
              {p.label}
            </Chip>
          ))}
        </div>
        <span className="flex-1" />
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="bp-start">From</Label>
            <Input
              id="bp-start"
              type="date"
              className="h-9 w-[160px] text-[13px]"
              value={range.start}
              max={range.end || undefined}
              onChange={(e) => set({ preset: null, start: e.target.value || null, end: range.end || todayISO() })}
            />
          </div>
          <div>
            <Label htmlFor="bp-end">To</Label>
            <Input
              id="bp-end"
              type="date"
              className="h-9 w-[160px] text-[13px]"
              value={range.end}
              min={range.start || undefined}
              onChange={(e) => set({ preset: null, start: range.start || null, end: e.target.value || null })}
            />
          </div>
        </div>
      </section>

      {q.error != null && !d ? (
        <Panel>
          <ErrorState error={q.error} onRetry={q.reload} />
        </Panel>
      ) : !d ? (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]" role="status" aria-label="Loading board pack">
          <Skeleton className="h-[280px] rounded-card" />
          <Skeleton className="h-[280px] rounded-card" />
        </div>
      ) : (
        <div className={clsx(q.loading && "opacity-60 transition-opacity")}>
          <BoardPackBody d={d} />
        </div>
      )}

      <div className="mt-6">
        <Exports />
      </div>
    </>
  );
}
