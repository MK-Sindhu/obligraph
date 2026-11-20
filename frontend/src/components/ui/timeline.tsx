"use client";

import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";

export interface TimelineItem {
  id: string;
  /** Short label in the pill under the node (e.g. a reference number or a date). */
  pill: ReactNode;
  title?: ReactNode;
  meta?: ReactNode;
  /** The highlighted step: blue-gradient pill with a pointer. */
  active?: boolean;
  /** A step that isn't real yet (hollow, dashed node). */
  muted?: boolean;
  href?: string;
  /** Label for the segment leading into this step from the previous one. */
  connector?: ReactNode;
  connectorTone?: "accent" | "warn" | "muted";
  /** Extra content under the meta line. */
  extra?: ReactNode;
}

const CONNECTOR_TONE = {
  accent: "text-accent",
  warn: "text-[color:var(--sev-high)]",
  muted: "text-ink-3",
};

/**
 * Horizontal timeline: round knob-nodes on a thin azure line (the active one filled), each with a tag
 * label beneath. Scrolls sideways when there isn't room for every step.
 */
export function Timeline({
  items,
  ariaLabel,
  minItemWidth = 190,
  className,
}: {
  items: TimelineItem[];
  ariaLabel: string;
  minItemWidth?: number;
  className?: string;
}) {
  const n = items.length;
  const TOP = 44; // space above the line for connector labels
  const NODE = 18;
  return (
    <div className={clsx("-mx-2 overflow-x-auto px-2 pb-2", className)}>
      <ol aria-label={ariaLabel} className="relative flex" style={{ minWidth: n * minItemWidth }}>
        {n > 1 && (
          <span
            aria-hidden="true"
            className="absolute h-[2px] rounded-full bg-primary"
            style={{ left: `calc(100% / ${2 * n})`, right: `calc(100% / ${2 * n})`, top: TOP + NODE / 2 - 1 }}
          />
        )}
        {items.map((it, i) => {
          const body = (
            <>
              <span
                className={clsx(
                  "relative inline-flex max-w-full items-center justify-center truncate rounded-[8px] px-3 py-1.5 text-[12px] font-semibold leading-none",
                  it.active
                    ? "bg-primary-fill text-white"
                    : it.muted
                      ? "border border-dashed border-line-strong text-ink-3"
                      : "border border-line-strong bg-surface text-ink-2",
                )}
              >
                {it.active && (
                  <span aria-hidden="true" className="absolute -top-[4px] left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 rounded-[1px] bg-primary-fill" />
                )}
                <span className="relative truncate">{it.pill}</span>
              </span>
              {it.title && (
                <span
                  className={clsx(
                    "mt-2.5 line-clamp-2 text-[12.5px] leading-snug",
                    it.muted ? "text-ink-3" : "font-medium text-ink",
                    it.href && "group-hover:text-accent group-hover:underline",
                  )}
                >
                  {it.title}
                </span>
              )}
              {it.meta && <span className="mt-1 text-[11.5px] text-ink-3">{it.meta}</span>}
              {it.extra}
            </>
          );
          return (
            <li key={it.id} className="relative flex min-w-0 flex-1 flex-col items-center px-2 text-center" aria-current={it.active ? "step" : undefined}>
              <div className="relative w-full" style={{ height: TOP }}>
                {i > 0 && it.connector && (
                  <span
                    className={clsx(
                      "absolute bottom-2 left-0 max-w-[calc(100%-16px)] -translate-x-1/2 truncate whitespace-nowrap text-[11px] font-medium",
                      CONNECTOR_TONE[it.connectorTone ?? "accent"],
                    )}
                  >
                    {it.connector}
                  </span>
                )}
              </div>
              <span
                aria-hidden="true"
                className={clsx(
                  "relative z-[1] flex shrink-0 items-center justify-center rounded-full border-2 bg-surface",
                  it.muted ? "border-dashed border-ink-4" : it.active ? "border-primary" : "border-primary",
                )}
                style={{ width: NODE, height: NODE }}
              >
                {it.active && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
              </span>
              {it.href ? (
                <Link href={it.href} className="group mt-3 flex max-w-full flex-col items-center rounded-[16px] px-2 pb-1">
                  {body}
                </Link>
              ) : (
                <div className="mt-3 flex max-w-full flex-col items-center px-2 pb-1">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
