"use client";

import clsx from "clsx";
import { useId, type ReactNode } from "react";

export interface GaugeSegment {
  key: string;
  value: number;
  /** CSS colour, usually a token var such as var(--cov-covered). */
  color: string;
  label: string;
}

/**
 * Thin progress ring with the number inside. Azure by default; pass `tone="negative"` for a red
 * ring (or `tone="auto"` with `warnBelow` to turn red when the value is low).
 */
export function ProgressRing({
  value,
  size = 64,
  stroke = 5,
  label,
  tone = "primary",
  warnBelow = 40,
  caption,
  className,
}: {
  /** 0–100, or null when unavailable. */
  value: number | null;
  size?: number;
  stroke?: number;
  /** Accessible description, e.g. "DPDP readiness 56%". */
  label: string;
  tone?: "primary" | "negative" | "auto";
  warnBelow?: number;
  caption?: ReactNode;
  className?: string;
}) {
  const c = size / 2;
  const r = c - stroke / 2 - 1;
  const circ = 2 * Math.PI * r;
  const v = value === null ? 0 : Math.max(0, Math.min(100, value));
  const red = tone === "negative" || (tone === "auto" && value !== null && v < warnBelow);
  return (
    <div className={clsx("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="absolute inset-0">
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        {value !== null && v > 0 && (
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={red ? "var(--negative)" : "var(--primary)"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(v / 100) * circ} ${circ}`}
            transform={`rotate(-90 ${c} ${c})`}
          />
        )}
      </svg>
      <span className="relative flex flex-col items-center leading-none" aria-hidden="true">
        <span className="figure text-ink" style={{ fontSize: Math.max(12, Math.round(size * 0.26)) }}>
          {value === null ? "—" : Math.round(v)}
        </span>
        {caption && <span className="mt-1 text-[10.5px] font-medium text-ink-3">{caption}</span>}
      </span>
    </div>
  );
}

/**
 * Coverage gauge: a thin azure ring for the headline value with the figure inside, and an
 * optional thinner inner ring that splits the whole into coloured segments (e.g. coverage states).
 */
export function DonutGauge({
  value,
  size = 200,
  thickness = 12,
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
  /** Composition for the thin inner ring. */
  segments?: GaugeSegment[];
  className?: string;
}) {
  const c = size / 2;
  const r1 = c - thickness / 2 - 1;
  const thin = Math.max(3, Math.round(thickness * 0.42));
  const gap = Math.max(6, thickness * 0.75);
  const r2 = r1 - thickness / 2 - gap - thin / 2;
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
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={c} cy={c} r={r1} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
        {value !== null && v > 0 && (
          <circle
            cx={c}
            cy={c}
            r={r1}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ1}`}
            transform={`rotate(-90 ${c} ${c})`}
          />
        )}
        {segments && <circle cx={c} cy={c} r={r2} fill="none" stroke="var(--surface-3)" strokeWidth={thin} />}
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
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="figure leading-none text-accent" style={{ fontSize: Math.round(size * 0.2) }}>
          {centerLabel ??
            (value === null ? (
              "—"
            ) : (
              <>
                {Math.round(v)}
                <span className="text-[0.5em]">%</span>
              </>
            ))}
        </span>
        {centerCaption && <span className="mt-1.5 text-[11.5px] font-medium text-ink-3">{centerCaption}</span>}
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

const TONE_COLOR = { blue: "var(--primary)", green: "var(--positive-area)", red: "var(--negative)" } as const;
type Tone = keyof typeof TONE_COLOR;

/**
 * Area chart on a light grid with a dot on every point, after the reference kit: green when the
 * first series rises, red when it falls (`tone="auto"`), or a fixed tone. A highlighted point
 * carries its value. Responsive: paths stretch with the container while strokes and dots stay
 * crisp. The first series is drawn in front; later series sit behind it, lighter.
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
  tone = "blue",
  higherIsBetter = true,
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
  /** auto: green when the first series ends higher than it starts, red when lower. */
  tone?: Tone | "auto";
  /** With tone="auto": whether a rise is good (green) or bad (red). */
  higherIsBetter?: boolean;
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
  const rising = first.length > 1 && first[first.length - 1] >= first[0];
  const resolved: Tone = tone === "auto" ? (first.length < 2 ? "blue" : rising === higherIsBetter ? "green" : "red") : tone;
  const color = TONE_COLOR[resolved];
  const cols = Math.max(2, len);

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
            <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {showGrid && (
            <g stroke="var(--line)" vectorEffect="non-scaling-stroke">
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <line key={`h${f}`} x1={0} x2={W} y1={f * H} y2={f * H} vectorEffect="non-scaling-stroke" />
              ))}
              {Array.from({ length: cols }, (_, i) => (
                <line key={`v${i}`} x1={(i / (cols - 1)) * W} x2={(i / (cols - 1)) * W} y1={0} y2={H} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          )}
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
                  stroke={color}
                  strokeWidth={layer === 0 ? 2.25 : 1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        </svg>
        {/* Dots as HTML so they stay round while the SVG stretches. */}
        {first.map((v, i) =>
          i === hi ? null : (
            <span
              key={i}
              aria-hidden="true"
              className="pointer-events-none absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-2"
              style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(v) / H) * 100}%` }}
            />
          ),
        )}
        {hi >= 0 && first[hi] !== undefined && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${(x(hi) / W) * 100}%`, top: `${(y(first[hi]) / H) * 100}%` }}
            aria-hidden="true"
          >
            <span className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[6px] bg-ink px-1.5 py-[3px] text-[11px] font-semibold leading-none text-surface">
              {formatValue(first[hi])}
            </span>
            <span className="block h-3 w-3 rounded-full border-2 bg-surface" style={{ borderColor: color }} />
          </div>
        )}
      </div>
      {labels && (
        <div className="mt-2 flex justify-between gap-1 text-[11px] text-ink-3" aria-hidden="true">
          {labels.map((l, i) => (
            <span key={i} className={clsx("min-w-0 truncate", i === hi && "font-semibold text-ink")}>
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
