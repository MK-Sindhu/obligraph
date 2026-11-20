"use client";

import clsx from "clsx";
import { Building2, FileText, Gauge, ListChecks, ScrollText, Sparkles, SquareStack, Unplug, Users } from "lucide-react";
import { IconTile } from "@/components/ui/button";
import { Panel } from "@/components/ui/misc";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import type { AdminOverview } from "@/lib/api";
import { fmtNumber, humanize } from "@/lib/format";

const COUNT_ORDER = ["regulations", "requirements", "documents", "orgs", "users", "obligations"];
const COUNT_ICON: Record<string, React.ReactNode> = {
  regulations: <ScrollText size={15} />,
  requirements: <SquareStack size={15} />,
  documents: <FileText size={15} />,
  orgs: <Building2 size={15} />,
  users: <Users size={15} />,
  obligations: <ListChecks size={15} />,
};

const COUNT_LABEL: Record<string, string> = {
  regulations: "Regulations",
  requirements: "Requirements",
  documents: "Documents",
  orgs: "Organisations",
  users: "Users",
  obligations: "Obligations",
};

interface Props {
  data: AdminOverview | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

export function OverviewPanel({ data, loading, error, onRetry }: Props) {
  if (!data) {
    return (
      <Panel title="Platform">
        {loading ? <LoadingRows rows={3} label="Loading platform overview" /> : <ErrorState error={error} onRetry={onRetry} />}
      </Panel>
    );
  }
  const counts = [
    ...COUNT_ORDER.filter((k) => k in data.counts),
    ...Object.keys(data.counts).filter((k) => !COUNT_ORDER.includes(k)),
  ];
  const claude = data.ai_mode === "claude";
  return (
    <Panel title="Platform" meta="Across all organisations">
      <div className="grid grid-cols-2 gap-4 px-6 pb-6 pt-1 sm:grid-cols-3 xl:grid-cols-[repeat(6,minmax(0,1fr))_minmax(0,1.5fr)]">
        {counts.map((k) => (
          <div key={k} className="min-w-0 rounded-tile card px-4 py-4">
            {COUNT_ICON[k] && (
              <IconTile tone="accent" size="xs" className="mb-3">
                {COUNT_ICON[k]}
              </IconTile>
            )}
            <p className="truncate text-[12px] font-medium text-ink-2" title={COUNT_LABEL[k] ?? humanize(k)}>
              {COUNT_LABEL[k] ?? humanize(k)}
            </p>
            <p className="figure mt-1.5 text-[28px] leading-none text-accent">{fmtNumber(data.counts[k])}</p>
          </div>
        ))}
        <div className="col-span-2 rounded-tile bg-surface-2 px-4 py-4 sm:col-span-3 xl:col-span-1">
          <p className="text-[12px] font-medium text-ink-2">AI engine</p>
          <p
            className={clsx(
              "mt-1.5 inline-flex items-center gap-1.5 text-[14px] font-medium",
              claude ? "text-accent" : "text-ink-2",
            )}
          >
            {claude ? <Sparkles size={14} aria-hidden="true" /> : <Unplug size={14} aria-hidden="true" />}
            {claude ? "Claude" : "Offline heuristics"}
          </p>
          <p className="mt-0.5 truncate font-mono text-[11.5px] text-ink-3" title={data.model}>
            {claude ? data.model : `Configured model: ${data.model}`}
          </p>
        </div>
      </div>
    </Panel>
  );
}

export function UsagePanel({ data, loading, error, onRetry }: Props) {
  const rows = data?.llm_usage ?? [];
  const totals = rows.reduce(
    (t, r) => ({
      calls: t.calls + r.calls,
      input: t.input + r.input_tokens,
      output: t.output + r.output_tokens,
      cache: t.cache + r.cache_read_tokens,
      errors: t.errors + r.errors,
    }),
    { calls: 0, input: 0, output: 0, cache: 0, errors: 0 },
  );
  return (
    <Panel title="Model usage" meta={data ? `${fmtNumber(totals.calls)} calls` : undefined}>
      {!data && (loading ? <LoadingRows rows={3} label="Loading model usage" /> : <ErrorState error={error} onRetry={onRetry} compact />)}
      {data && rows.length === 0 && (
        <EmptyState icon={<Gauge size={22} />} title="No model calls yet" compact>
          {data.ai_mode === "offline"
            ? "Obligraph is running offline, so extraction, assessment and Copilot don't call Claude. Set ANTHROPIC_API_KEY on the API to enable it."
            : "Calls to Claude for extraction, assessment and Copilot are counted here."}
        </EmptyState>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto px-3 pb-3">
          <table className="w-full min-w-[620px] text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] text-ink-3 [&>th]:font-medium">
                <th className="px-4 py-2">Purpose</th>
                <th className="px-3 py-2 text-right">Calls</th>
                <th className="px-3 py-2 text-right">Input tokens</th>
                <th className="px-3 py-2 text-right">Output tokens</th>
                <th className="px-3 py-2 text-right">Cache reads</th>
                <th className="px-3 py-2 text-right">Avg latency</th>
                <th className="px-4 py-2 text-right">Errors</th>
              </tr>
            </thead>
            <tbody className="num">
              {rows.map((r) => (
                <tr key={r.purpose} className="border-t border-line">
                  <td className="px-4 py-2.5 font-medium">{humanize(r.purpose)}</td>
                  <td className="px-3 py-2.5 text-right">{fmtNumber(r.calls)}</td>
                  <td className="px-3 py-2.5 text-right text-ink-2">{fmtNumber(r.input_tokens)}</td>
                  <td className="px-3 py-2.5 text-right text-ink-2">{fmtNumber(r.output_tokens)}</td>
                  <td className="px-3 py-2.5 text-right text-ink-2">{fmtNumber(r.cache_read_tokens)}</td>
                  <td className="px-3 py-2.5 text-right text-ink-2">{fmtNumber(r.avg_latency_ms)} ms</td>
                  <td className={clsx("px-4 py-2.5 text-right", r.errors > 0 ? "font-medium text-danger" : "text-ink-3")}>
                    {fmtNumber(r.errors)}
                  </td>
                </tr>
              ))}
              <tr className="bg-surface-2 font-medium [&>td:first-child]:rounded-l-full [&>td:last-child]:rounded-r-full">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-3 py-2.5 text-right">{fmtNumber(totals.calls)}</td>
                <td className="px-3 py-2.5 text-right">{fmtNumber(totals.input)}</td>
                <td className="px-3 py-2.5 text-right">{fmtNumber(totals.output)}</td>
                <td className="px-3 py-2.5 text-right">{fmtNumber(totals.cache)}</td>
                <td className="px-3 py-2.5" />
                <td className={clsx("px-4 py-2.5 text-right", totals.errors > 0 && "text-danger")}>{fmtNumber(totals.errors)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
