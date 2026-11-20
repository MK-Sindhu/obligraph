"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

function clamp(v: number) {
  return Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));
}

/**
 * Display-only slider: a thin grey track, an azure fill and a round white knob ringed in azure,
 * with the value shown large to the side ("71%").
 */
export function ProgressSlider({
  value,
  label,
  caption,
  showValue = true,
  valueLabel,
  size = "md",
  className,
}: {
  /** 0–100 */
  value: number;
  /** Accessible name and visible caption above the track. */
  label: string;
  /** Extra text under the track. */
  caption?: ReactNode;
  showValue?: boolean;
  /** Override the big value text (defaults to "71%"). */
  valueLabel?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  const v = clamp(value);
  const md = size === "md";
  return (
    <div className={clsx("min-w-0", className)}>
      <div className="flex items-end gap-4">
        <div className="min-w-0 flex-1">
          <p className="mb-2.5 text-[12.5px] font-medium text-ink-2">{label}</p>
          <div
            role="meter"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(v)}
            className={clsx("relative rounded-full bg-surface-3", md ? "h-1.5" : "h-1")}
          >
            <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${v}%` }} />
            <span
              aria-hidden="true"
              className={clsx(
                "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-surface",
                md ? "h-4 w-4" : "h-3.5 w-3.5",
              )}
              style={{ left: `${v}%` }}
            />
          </div>
          {caption && <p className="mt-2.5 text-[12px] text-ink-3">{caption}</p>}
        </div>
        {showValue && (
          <span className={clsx("figure shrink-0 leading-none text-accent", md ? "text-[30px]" : "text-[22px]")}>
            {valueLabel ?? (
              <>
                {Math.round(v)}
                <span className="text-[0.55em] text-ink-3">%</span>
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

/** Thin bar for legends and per-row shares. `color` overrides the gradient (e.g. a coverage colour). */
export function ProgressBar({
  value,
  color,
  label,
  className,
  height = 6,
}: {
  value: number;
  color?: string;
  label?: string;
  className?: string;
  height?: number;
}) {
  const v = clamp(value);
  return (
    <span
      role={label ? "meter" : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? Math.round(v) : undefined}
      aria-hidden={label ? undefined : true}
      className={clsx("relative block overflow-hidden rounded-full bg-surface-3", className)}
      style={{ height }}
    >
      <span
        className={clsx("absolute inset-y-0 left-0 rounded-full", !color && "bg-primary")}
        style={{ width: `${v}%`, background: color }}
      />
    </span>
  );
}
