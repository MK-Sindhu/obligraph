"use client";

import Link from "next/link";
import { COVERAGE_LABEL, CoverageGlyph } from "@/components/domain/badges";
import { DonutGauge } from "@/components/ui/charts";
import { ProgressBar } from "@/components/ui/progress";
import type { Coverage } from "@/lib/api";

const ORDER: Coverage[] = ["covered", "partial", "missing", "unassessed"];

/**
 * Coverage gauge: the blue-gradient arc is the weighted coverage figure (covered + ½ partial,
 * over assessed obligations, the backend's definition); the thin inner ring splits every
 * obligation by coverage state in the coverage colours.
 */
export function CoverageRing({
  counts,
  pct,
  size = 208,
}: {
  counts: Partial<Record<Coverage, number>>;
  pct: number | null;
  size?: number;
}) {
  return (
    <DonutGauge
      value={pct}
      size={size}
      thickness={9}
      label={`Weighted policy coverage ${pct === null ? "not available" : `${Math.round(pct)}%`}`}
      centerCaption="covered"
      segments={ORDER.map((k) => ({ key: k, value: counts[k] ?? 0, color: `var(--cov-${k})`, label: COVERAGE_LABEL[k] }))}
    />
  );
}

export function CoverageLegend({ counts }: { counts: Partial<Record<Coverage, number>> }) {
  const total = ORDER.reduce((n, k) => n + (counts[k] ?? 0), 0);
  return (
    <ul className="w-full space-y-1">
      {ORDER.map((k) => {
        const n = counts[k] ?? 0;
        const share = total ? (n / total) * 100 : 0;
        return (
          <li key={k}>
            <Link
              href={`/obligations?coverage=${k}`}
              className="group grid grid-cols-[16px_minmax(0,1fr)_auto_40px] items-center gap-x-3 gap-y-1.5 rounded-[16px] px-3 py-2 transition-colors hover:bg-surface-2"
            >
              <CoverageGlyph coverage={k} />
              <span className="text-[13px] text-ink group-hover:text-accent">{COVERAGE_LABEL[k]}</span>
              <span className="num text-[13.5px] font-medium text-ink">{n}</span>
              <span className="num text-right text-[12px] text-ink-3">{Math.round(share)}%</span>
              <ProgressBar value={share} color={`var(--cov-${k})`} className="col-span-3 col-start-2" height={5} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
