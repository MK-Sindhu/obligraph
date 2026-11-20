"use client";

import clsx from "clsx";
import { useId, type ReactNode } from "react";

// The accent gradient is the same in both themes.
const GRAD_A = "#2348f5";
const GRAD_B = "#3f8cff";

export interface GaugeSegment {
  key: string;
  value: number;
  /** CSS colour, usually a token var such as var(--cov-covered). */
  color: string;
  label: string;
}

/**
 * Donut gauge: a blue-gradient arc for the headline value, a thinner secondary ring (either a
 * plain grey track or a composition split into coloured segments) and an embossed centre disc
 * holding the large figure.
 */
export function DonutGauge({
  value,
  size = 200,
  thickness = 16,
  label,
  centerLabel,
  centerCaption,
  segments,
  className,
}: {
  /** 0–100, or null when unavailable. */
  value: number | null;
  size?: number;
  thickness?: number;
  /** Accessible description of the gauge. */
  label: string;
  /** Overrides the centre figure (defaults to "75%"). */
  centerLabel?: ReactNode;
  centerCaption?: ReactNode;
  /** Composition for the thin secondary ring. */
  segments?: GaugeSegment[];
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const c = size / 2;
  const r1 = c - thickness / 2 - 2;
  const thin = Math.max(4, Math.round(thickness * 0.34));
  const gap = Math.max(5, thickness * 0.45);
  const r2 = r1 - thickness / 2 - gap - thin / 2;
  const disc = 2 * (r2 - thin / 2 - gap * 0.9);
  const circ1 = 2 * Math.PI * r1;
  const circ2 = 2 * Math.PI * r2;
  const v = value === null ? 0 : Math.max(0, Math.min(100, value));
  const dash = (v / 100) * circ1;

  const total = (segments ?? []).reduce((n, s) => n + s.value, 0);
  const present = (segments ?? []).filter((s) => s.value > 0);
  const segGap = present.length > 1 ? 3 : 0;
  const lens = present.map((s) => (s.value / total) * circ2);
  const arcs = present.map((s, i) => ({
    ...s,
    dash: Math.max(0.5, lens[i] - segGap),
    offset: lens.slice(0, i).reduce((x, y) => x + y, 0),
  }));

  return (
    <div className={clsx("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="overflow-visible">
        <defs>
          <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={GRAD_B} />
            <stop offset="100%" stopColor={GRAD_A} />
          </linearGradient>
        </defs>
        {/* main track */}
        <circle cx={c} cy={c} r={r1} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
        <circle cx={c} cy={c} r={r1} fill="none" stroke="var(--line)" strokeWidth={1} opacity={0.7} transform={`translate(0.6 0.6)`} />
        {value !== null && v > 0 && (
          <circle
            cx={c}
            cy={c}
            r={r1}
            fill="none"
            stroke={`url(#g-${id})`}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ1}`}
            transform={`rotate(-90 ${c} ${c})`}
            style={{ filter: "drop-shadow(0 4px 6px rgb(43 91 255 / 0.35))" }}
          />
        )}
        {/* secondary ring */}
        <circle cx={c} cy={c} r={r2} fill="none" stroke="var(--surface-3)" strokeWidth={thin} />
        {arcs.length > 0 && (
          <g transform={`rotate(-90 ${c} ${c})`}>
            {arcs.map((a) => (
              <circle
                key={a.key}
                cx={c}
                cy={c}
                r={r2}
                fill="none"
                stroke={a.color}
                strokeWidth={thin}
                strokeLinecap={present.length > 1 ? "butt" : "round"}
                strokeDasharray={`${a.dash} ${circ2 - a.dash}`}
                strokeDashoffset={-a.offset}
              >
                <title>{`${a.label}: ${a.value} of ${total}`}</title>
              </circle>
            ))}
          </g>
        )}
      </svg>
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full soft-sm"
        style={{ width: disc, height: disc }}
      >
        <span className="figure leading-none text-ink" style={{ fontSize: Math.round(disc * 0.3) }}>
          {centerLabel ??
            (value === null ? (
              "—"
            ) : (
              <>
                {Math.round(v)}
                <span className="text-[0.5em] text-ink-3">%</span>
              </>
            ))}
        </span>
        {centerCaption && <span className="mt-1 text-[11px] text-ink-3">{centerCaption}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- line / area chart

export interface ChartSeries {
  label: string;
  values: number[];
}

/** Monotone cubic path through points (no overshoot below the baseline). */
function monotonePath(pts: [number, number][]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    m.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1));
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const h = dx[i] / 3;
    d += ` C${x0 + h},${y0 + t[i] * h} ${x1 - h},${y1 - t[i + 1] * h} ${x1},${y1}`;
  }
  return d;
}

/**
 * Thin blue line chart with optional layered gradient areas and a highlighted knob.
 * Responsive: paths stretch with the container while strokes and the knob stay crisp.
 * The first series is drawn in front; later series sit behind it, lighter.
 */
export function AreaChart({
  series,
  labels,
  height = 140,
  area = true,
  highlight,
  formatValue = (v) => String(v),
  ariaLabel,
  className,
  showGrid = true,
}: {
  series: ChartSeries[];
  /** X-axis labels (one per value). */
  labels?: string[];
  height?: number;
  area?: boolean;
  /** Index of the point to highlight on the first series (defaults to its maximum). */
  highlight?: number;
  formatValue?: (v: number) => string;
  ariaLabel: string;
  className?: string;
  showGrid?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const W = 300;
  const H = 100;
  const pad = 8;
  const len = Math.max(0, ...series.map((s) => s.values.length));
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const x = (i: number) => (len <= 1 ? W / 2 : (i / (len - 1)) * W);
  const y = (v: number) => H - pad - (v / (max * 1.12)) * (H - pad * 2);
  const first = series[0]?.values ?? [];
  const hi = highlight ?? (first.length ? first.indexOf(Math.max(...first)) : -1);

  return (
    <figure className={clsx("relative min-w-0", className)}>
      <div className="relative" style={{ height }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          role="img"
          aria-label={ariaLabel}
        >
          <defs>
            <linearGradient id={`line-${id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={GRAD_A} />
              <stop offset="100%" stopColor={GRAD_B} />
            </linearGradient>
            <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GRAD_B} stopOpacity="0.38" />
              <stop offset="100%" stopColor={GRAD_B} stopOpacity="0" />
            </linearGradient>
          </defs>
          {showGrid &&
            [0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1={0}
                x2={W}
                y1={pad + f * (H - pad * 2)}
                y2={pad + f * (H - pad * 2)}
                stroke="var(--line)"
                strokeDasharray="3 4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          {[...series].reverse().map((s, ri) => {
            const layer = series.length - 1 - ri;
            const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
            const line = monotonePath(pts);
            const areaPath = pts.length ? `${line} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z` : "";
            const op = layer === 0 ? 1 : Math.max(0.25, 0.55 - layer * 0.15);
            return (
              <g key={s.label} opacity={op}>
                {area && <path d={areaPath} fill={`url(#fill-${id})`} />}
                <path
                  d={line}
                  fill="none"
                  stroke={`url(#line-${id})`}
                  strokeWidth={layer === 0 ? 2.5 : 1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        </svg>
        {hi >= 0 && first[hi] !== undefined && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${(x(hi) / W) * 100}%`, top: `${(y(first[hi]) / H) * 100}%` }}
            aria-hidden="true"
          >
            <span className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent-grad-text px-2 py-[3px] text-[11px] font-medium leading-none text-white shadow-glow-sm">
              {formatValue(first[hi])}
            </span>
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-surface-hi shadow-knob">
              <span className="h-2 w-2 rounded-full bg-accent-grad-diag" />
            </span>
          </div>
        )}
      </div>
      {labels && (
        <div className="mt-2 flex justify-between gap-1 text-[11px] text-ink-3" aria-hidden="true">
          {labels.map((l, i) => (
            <span key={i} className={clsx("min-w-0 truncate", i === hi && "font-medium text-accent")}>
              {l}
            </span>
          ))}
        </div>
      )}
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Point</th>
            {series.map((s) => (
              <th key={s.label} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: len }, (_, i) => (
            <tr key={i}>
              <th scope="row">{labels?.[i] ?? i + 1}</th>
              {series.map((s) => (
                <td key={s.label}>{s.values[i] !== undefined ? formatValue(s.values[i]) : "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Compact single-series line for tiles. */
export function Sparkline({ values, label, height = 44, className }: { values: number[]; label: string; height?: number; className?: string }) {
  return (
    <AreaChart
      series={[{ label, values }]}
      height={height}
      ariaLabel={label}
      showGrid={false}
      className={className}
      highlight={values.length - 1}
    />
  );
}
