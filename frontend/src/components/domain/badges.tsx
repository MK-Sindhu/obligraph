"use client";

import clsx from "clsx";
import { BadgeCheck, CircleSlash, History, Sparkles } from "lucide-react";
import type { Coverage, Severity } from "@/lib/api";
import { humanize, label, OBLIGATION_STATUS_LABEL, REG_STATUS_LABEL } from "@/lib/format";

// ---------------------------------------------------------------- severity

export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
const SEV_LEVEL: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export function sevColor(sev: string): string {
  return SEV_LEVEL[sev] ? `var(--sev-${sev})` : "var(--ink-3)";
}

/** Four ascending bars; the number filled encodes the level, colour reinforces it. */
export function SeverityGlyph({ severity, className }: { severity: string; className?: string }) {
  const level = SEV_LEVEL[severity] ?? 0;
  const color = sevColor(severity);
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" className={clsx("shrink-0", className)} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={i * 3.6}
          y={9 - i * 3}
          width="2.4"
          height={3 + i * 3}
          rx="1.2"
          fill={i < level ? color : "var(--line-strong)"}
        />
      ))}
    </svg>
  );
}

export function SeverityBadge({ severity, className, compact }: { severity: string; className?: string; compact?: boolean }) {
  const known = SEV_LEVEL[severity] !== undefined;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[4px] text-[12px] font-medium leading-none",
        className,
      )}
      style={{
        color: known ? `var(--sev-${severity})` : "var(--ink-2)",
        background: known ? `var(--sev-${severity}-bg)` : "var(--surface-3)",
      }}
      title={`Severity: ${humanize(severity)}`}
    >
      <SeverityGlyph severity={severity} />
      {!compact && humanize(severity)}
    </span>
  );
}

// ---------------------------------------------------------------- coverage

export const COVERAGES: Coverage[] = ["covered", "partial", "missing", "unassessed"];
export const COVERAGE_LABEL: Record<string, string> = {
  covered: "Covered",
  partial: "Partial",
  missing: "Missing",
  unassessed: "Unassessed",
};

export function covColor(c: string): string {
  return COVERAGE_LABEL[c] ? `var(--cov-${c})` : "var(--ink-3)";
}

/** Circle that fills with coverage: full, half, empty ring, dashed ring. */
export function CoverageGlyph({ coverage, size = 12, className }: { coverage: string; size?: number; className?: string }) {
  const color = covColor(coverage);
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" className={clsx("shrink-0", className)} aria-hidden="true">
      {coverage === "covered" && <circle cx="6" cy="6" r="5" fill={color} />}
      {coverage === "partial" && (
        <>
          <circle cx="6" cy="6" r="4.4" fill="none" stroke={color} strokeWidth="1.4" />
          <path d="M6 1.6 A4.4 4.4 0 0 0 6 10.4 Z" fill={color} />
        </>
      )}
      {coverage === "missing" && (
        <>
          <circle cx="6" cy="6" r="4.4" fill="none" stroke={color} strokeWidth="1.4" />
          <path d="M4.2 4.2 L7.8 7.8 M7.8 4.2 L4.2 7.8" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
        </>
      )}
      {coverage !== "covered" && coverage !== "partial" && coverage !== "missing" && (
        <circle cx="6" cy="6" r="4.4" fill="none" stroke={color} strokeWidth="1.3" strokeDasharray="1.8 1.6" />
      )}
    </svg>
  );
}

export function CoverageBadge({
  coverage,
  confidence,
  className,
}: {
  coverage: string;
  confidence?: number | null;
  className?: string;
}) {
  const known = COVERAGE_LABEL[coverage] !== undefined;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[4px] text-[12px] font-medium leading-none",
        className,
      )}
      style={{
        color: known ? `var(--cov-${coverage}-ink)` : "var(--ink-2)",
        background: known ? `var(--cov-${coverage}-bg)` : "var(--surface-3)",
      }}
      title={confidence != null ? `${COVERAGE_LABEL[coverage] ?? coverage}, confidence ${Math.round(confidence * 100)}%` : undefined}
    >
      <CoverageGlyph coverage={coverage} />
      {COVERAGE_LABEL[coverage] ?? humanize(coverage)}
      {confidence != null && <span className="num font-normal opacity-75">{Math.round(confidence * 100)}%</span>}
    </span>
  );
}

// ---------------------------------------------------------------- statuses

/** Prominent status pill for an instrument's legal status (detail headers). */
export function StatusStamp({ status, size = "sm", className }: { status: string; size?: "sm" | "lg"; className?: string }) {
  const inForce = status === "in_force";
  const superseded = status === "superseded";
  const Icon = inForce ? BadgeCheck : superseded ? History : CircleSlash;
  const lg = size === "lg";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-full font-medium leading-none",
        lg ? "h-10 px-5 text-[13.5px]" : "h-7 px-3 text-[12px]",
        inForce && "bg-primary-fill text-white",
        superseded && "bg-[var(--sev-high-bg)] text-[color:var(--sev-high)] shadow-xs",
        !inForce && !superseded && "border border-dashed border-line-strong text-ink-3",
        className,
      )}
    >
      <Icon size={lg ? 16 : 13} aria-hidden="true" />
      {label(REG_STATUS_LABEL, status)}
    </span>
  );
}

/** Flat, quieter badge for instrument status in dense lists. */
export function RegStatusBadge({ status }: { status: string }) {
  const inForce = status === "in_force";
  const superseded = status === "superseded";
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[4px] text-[11.5px] font-medium leading-none",
        inForce && "bg-accent-wash text-accent",
        superseded && "bg-[var(--sev-high-bg)] text-[color:var(--sev-high)] line-through decoration-1",
        !inForce && !superseded && "border border-dashed border-line-strong text-ink-3",
      )}
    >
      {label(REG_STATUS_LABEL, status)}
    </span>
  );
}

const OB_STATUS_STYLE: Record<string, string> = {
  open: "text-ink-2 border-line-strong",
  in_progress: "text-accent border-accent/45 bg-accent-wash/60",
  met: "text-ok border-[color:var(--ok)]/45",
  not_applicable: "text-ink-3 border-dashed border-line-strong",
};

export function ObligationStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11.5px] font-medium leading-snug",
        OB_STATUS_STYLE[status] ?? "text-ink-2 border-line",
      )}
    >
      {label(OBLIGATION_STATUS_LABEL, status)}
    </span>
  );
}

const PRIORITY_STYLE: Record<string, { color: string; bg: string }> = {
  urgent: { color: "var(--sev-critical)", bg: "var(--sev-critical-bg)" },
  high: { color: "var(--sev-high)", bg: "var(--sev-high-bg)" },
  medium: { color: "var(--sev-medium)", bg: "var(--sev-medium-bg)" },
  low: { color: "var(--sev-low)", bg: "var(--sev-low-bg)" },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const s = PRIORITY_STYLE[priority];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-[3px] text-[10.5px] font-semibold uppercase leading-none tracking-[0.06em]"
      style={s ? { color: s.color, background: s.bg } : undefined}
    >
      {priority}
    </span>
  );
}

export function RegulatorTag({ regulator, className }: { regulator: string; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center rounded-full bg-[var(--reg-tag-bg)] px-2 py-[3px] font-mono text-[10px] font-medium leading-none tracking-[0.06em] text-[color:var(--reg-tag-fg)]",
        className,
      )}
    >
      {regulator}
    </span>
  );
}

export function AiTag({ source }: { source: string }) {
  if (source !== "ai" && source !== "ai_edited") return null;
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-wash px-2 py-[3px] text-[11px] font-medium leading-none text-accent"
      title={source === "ai" ? "Suggested by Obligraph from the coverage assessment" : "Suggested by Obligraph, then edited"}
    >
      <Sparkles size={11} aria-hidden="true" />
      {source === "ai" ? "Suggested" : "Suggested · edited"}
    </span>
  );
}

export function SeverityLegend({ className }: { className?: string }) {
  return (
    <div className={clsx("flex flex-wrap items-center gap-3 text-[12px] text-ink-2", className)}>
      {SEVERITIES.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <SeverityGlyph severity={s} /> {humanize(s)}
        </span>
      ))}
    </div>
  );
}
