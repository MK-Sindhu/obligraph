"use client";

import clsx from "clsx";
import { ListTodo, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Chip } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Panel } from "@/components/ui/misc";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { api, type JobOut } from "@/lib/api";
import { fmtDateTime, fmtNumber, humanize, relativeTime } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { StatusPill } from "./status";

const KNOWN_STATUSES = ["queued", "running", "done", "failed"];

function duration(j: JobOut): string | null {
  if (!j.finished_at) return null;
  const ms = new Date(j.finished_at).getTime() - new Date(j.created_at).getTime();
  if (ms < 1000) return `${Math.max(0, ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 60_000)} min`;
}

export function JobsPanel({ counts, onRefreshed }: { counts: Record<string, number> | undefined; onRefreshed: () => void }) {
  const [status, setStatus] = useState("");
  const jobs = useQuery<JobOut[]>(`admin:jobs:${status}`, (signal) => api.admin.jobs(status || undefined, { signal }));
  const statuses = [...new Set([...KNOWN_STATUSES, ...Object.keys(counts ?? {})])];
  const total = Object.values(counts ?? {}).reduce((a, b) => a + b, 0);
  const items = jobs.data ?? [];

  return (
    <Panel
      title="Background jobs"
      meta={jobs.data ? `Latest ${items.length}${status ? ` ${status}` : ""}` : undefined}
      actions={
        <IconButton
          label="Refresh jobs"
          size="sm"
          disabled={jobs.loading}
          onClick={() => {
            jobs.reload();
            onRefreshed();
          }}
        >
          <RefreshCw size={14} className={jobs.loading && jobs.data ? "animate-spin" : undefined} />
        </IconButton>
      }
    >
      <div role="radiogroup" aria-label="Filter jobs by status" className="flex flex-wrap gap-2 px-6 pb-3">
        {[{ key: "", label: "All", n: total }, ...statuses.map((s) => ({ key: s, label: humanize(s), n: counts?.[s] ?? 0 }))].map(
          (c) => (
            <Chip
              key={c.key || "all"}
              role="radio"
              aria-checked={status === c.key}
              active={status === c.key}
              onClick={() => setStatus(c.key)}
              count={counts ? fmtNumber(c.n) : undefined}
              className={clsx(c.key === "failed" && c.n > 0 && status !== c.key && "border-danger/40! text-danger!")}
            >
              {c.label}
            </Chip>
          ),
        )}
      </div>
      {jobs.loading && !jobs.data && <LoadingRows rows={5} label="Loading jobs" />}
      {jobs.error != null && !jobs.data && <ErrorState error={jobs.error} onRetry={jobs.reload} compact />}
      {jobs.data && items.length === 0 && (
        <EmptyState icon={<ListTodo size={22} />} title={status ? `No ${status} jobs` : "No jobs yet"} compact>
          Crawls, extractions and assessments run as background jobs and show up here.
        </EmptyState>
      )}
      {items.length > 0 && (
        <div className="mx-3 mb-3 max-h-[440px] overflow-auto">
          <table className="w-full min-w-[460px] text-[13px]">
            <thead className="sticky top-0 z-[1] bg-surface">
              <tr className="text-left text-[11.5px] text-ink-3 [&>th]:font-medium">
                <th className="px-4 py-2">Job</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Tries</th>
                <th className="px-4 py-2">Queued · turnaround</th>
              </tr>
            </thead>
            <tbody>
              {items.map((j) => (
                <tr key={j.id} className="border-t border-line align-top">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{humanize(j.kind)}</p>
                    <p className="font-mono text-[10.5px] text-ink-3">{j.id.slice(0, 8)}</p>
                    {j.last_error && (
                      <details className="mt-1 max-w-[300px] text-[12px]">
                        <summary className="cursor-pointer truncate text-danger">{j.last_error.split("\n")[0]}</summary>
                        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-[12px] bg-surface-2 p-2.5 font-mono text-[11px] text-ink-2">
                          {j.last_error}
                        </pre>
                      </details>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill status={j.status} />
                  </td>
                  <td className="num px-3 py-2.5 text-right text-ink-2">{j.attempts}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-2">
                    <span title={`Queued ${fmtDateTime(j.created_at)}`}>{relativeTime(j.created_at)}</span>
                    <span
                      className="mt-0.5 block font-mono text-[11px] text-ink-3"
                      title={j.finished_at ? `Finished ${fmtDateTime(j.finished_at)}` : undefined}
                    >
                      {j.finished_at ? `${j.status === "failed" ? "failed after" : "done in"} ${duration(j)}` : j.status === "running" ? "running…" : "not finished"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
