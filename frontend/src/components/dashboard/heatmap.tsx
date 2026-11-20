"use client";

import clsx from "clsx";
import Link from "next/link";
import { useState } from "react";
import { SEVERITIES, SeverityGlyph } from "@/components/domain/badges";
import { Segmented } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import type { HeatmapRow } from "@/lib/api";
import { humanize } from "@/lib/format";
import { useVocab } from "@/lib/vocab";

type Axis = "topic" | "regulator";

/** Blue intensity 0–5: more open gaps, deeper blue. */
function level(n: number, max: number): number {
  if (n <= 0 || max <= 0) return 0;
  return Math.min(5, Math.max(1, Math.ceil((n / max) * 5)));
}

function cellHref(axis: Axis, key: string, sev: string): string {
  const p = new URLSearchParams({ coverage: "gaps", severity: sev });
  if (axis === "regulator") p.set("regulator", key);
  else {
    p.set("topic", key);
    p.set("primary", "1");
  }
  return `/obligations?${p.toString()}`;
}

/**
 * Open-gap heatmap: rows are topics (by a requirement's primary topic) or regulators,
 * columns are severities, and cell darkness is the number of missing + partial obligations.
 */
export function RiskHeatmap({ byTopic, byRegulator }: { byTopic: HeatmapRow[]; byRegulator: HeatmapRow[] }) {
  const [axis, setAxis] = useState<Axis>("topic");
  const { topic, regulator } = useVocab();
  const rows = axis === "topic" ? byTopic : byRegulator;
  const max = Math.max(0, ...rows.flatMap((r) => SEVERITIES.map((s) => r[s] ?? 0)));
  const rowLabel = (k: string) => (axis === "topic" ? topic(k) : regulator(k));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-1">
        <Segmented
          label="Group rows by"
          size="sm"
          value={axis}
          onChange={setAxis}
          options={[
            { value: "topic", label: "By topic" },
            { value: "regulator", label: "By regulator" },
          ]}
        />
        <div className="flex items-center gap-1.5 text-[11.5px] text-ink-3" aria-hidden="true">
          <span>Fewer</span>
          {[1, 2, 3, 4, 5].map((l) => (
            <span key={l} className="h-3.5 w-5 rounded-[5px] shadow-xs" style={{ background: `var(--heat-${l})` }} />
          ))}
          <span>More open gaps</span>
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState compact title="No open gaps">
          Every assessed obligation is covered by your policies.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto px-3 pb-5 pt-3 sm:px-5">
          <table className="w-full min-w-[330px] table-fixed border-separate border-spacing-[4px] sm:min-w-[540px] sm:border-spacing-[6px]">
            <caption className="sr-only">Open gaps (missing or partial coverage) by {axis} and severity</caption>
            <colgroup>
              <col className="w-[30%] sm:w-[34%]" />
              <col />
              <col />
              <col />
              <col />
              <col className="w-9 sm:w-14" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="pb-1 text-left text-[11.5px] font-medium text-ink-3">
                  {axis === "topic" ? "Primary topic" : "Regulator"}
                </th>
                {SEVERITIES.map((s) => (
                  <th key={s} scope="col" className="pb-1 text-center text-[11.5px] font-medium text-ink-2">
                    <span className="inline-flex items-center gap-1.5">
                      <SeverityGlyph severity={s} />
                      {/* Glyph only on phones so the grid fits without scrolling. */}
                      <span className="sr-only sm:not-sr-only">{humanize(s)}</span>
                    </span>
                  </th>
                ))}
                <th scope="col" className="pb-1 text-right text-[11.5px] font-medium text-ink-3">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row" className="max-w-[220px] truncate pr-1 text-left text-[12.5px] font-normal text-ink sm:pr-2 sm:text-[13px]" title={rowLabel(r.key)}>
                    {rowLabel(r.key)}
                  </th>
                  {SEVERITIES.map((s) => {
                    const n = r[s] ?? 0;
                    const l = level(n, max);
                    const desc = `${rowLabel(r.key)}, ${s}: ${n} open gap${n === 1 ? "" : "s"}`;
                    const style = { background: `var(--heat-${l})`, color: `var(--heat-fg-${l})` };
                    return (
                      <td key={s} className="p-0">
                        {n > 0 ? (
                          <Link
                            href={cellHref(axis, r.key, s)}
                            title={`${desc} — open in Obligations`}
                            aria-label={`${desc}. Open in Obligations`}
                            style={style}
                            className={clsx(
                              "num flex h-10 items-center justify-center rounded-[13px] text-[13.5px] font-semibold shadow-xs transition-[filter,box-shadow,transform]",
                              "hover:-translate-y-px hover:shadow-[0_0_0_2px_var(--accent),var(--shadow-xs)] hover:brightness-105",
                            )}
                          >
                            {n}
                          </Link>
                        ) : (
                          <span
                            title={desc}
                            style={style}
                            className="num flex h-10 items-center justify-center rounded-[13px] text-[12px]"
                          >
                            ·
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="num pl-1 text-right text-[13px] font-medium text-ink-2 sm:pl-2">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
