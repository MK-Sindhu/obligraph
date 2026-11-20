"use client";

import clsx from "clsx";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "solid" | "ok" | "warn" | "danger" | "outline" | "dashed";

const toneClass: Record<BadgeTone, string> = {
  neutral: "bg-surface-3/80 text-ink-2",
  accent: "bg-accent-wash text-accent",
  solid: "bg-accent-grad-text text-white shadow-glow-sm",
  ok: "bg-[var(--cov-covered-bg)] text-ok",
  warn: "bg-[var(--sev-medium-bg)] text-warn",
  danger: "bg-danger-bg text-danger",
  outline: "border border-line-strong text-ink-2",
  dashed: "border border-dashed border-line-strong text-ink-3",
};

/**
 * Soft pill badge. Pass `tone` for the standard palette, or `color` + `bg` (CSS values, usually
 * token vars such as `var(--sev-high)`) for domain colours.
 */
export function Badge({
  tone = "neutral",
  color,
  bg,
  icon,
  size = "md",
  mono,
  className,
  title,
  children,
  style,
}: {
  tone?: BadgeTone;
  color?: string;
  bg?: string;
  icon?: ReactNode;
  size?: "sm" | "md";
  mono?: boolean;
  className?: string;
  title?: string;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  const custom = color || bg;
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium leading-none",
        size === "sm" ? "px-2 py-[3px] text-[11px]" : "px-2.5 py-[5px] text-[12px]",
        mono && "font-mono text-[10.5px] uppercase tracking-[0.05em]",
        !custom && toneClass[tone],
        className,
      )}
      style={custom ? { color, background: bg, ...style } : style}
    >
      {icon}
      {children}
    </span>
  );
}

/** Small gradient count bubble (unread alerts, items in a column). */
export function CountBadge({ count, max = 9, className, tone = "solid" }: { count: number; max?: number; className?: string; tone?: "solid" | "soft" }) {
  return (
    <span
      className={clsx(
        "num inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-semibold leading-none",
        tone === "solid" ? "bg-accent-grad-text text-white shadow-glow-sm" : "bg-surface-3 text-ink-2",
        className,
      )}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}

/**
 * Selectable filter chip (toggle button). Active: the blue gradient pill; inactive: a soft pill
 * with an outline.
 */
export function Chip({
  active,
  icon,
  count,
  className,
  children,
  type = "button",
  ...rest
}: ComponentProps<"button"> & { active?: boolean; icon?: ReactNode; count?: ReactNode }) {
  return (
    <button
      type={type}
      aria-pressed={rest.role ? undefined : !!active}
      className={clsx(
        "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[12.5px] font-medium transition-[background-color,box-shadow,color,border-color] duration-150",
        active
          ? "border border-transparent bg-accent-grad-text text-white shadow-glow-sm"
          : "border border-line-strong/80 bg-surface-grad text-ink-2 shadow-raised-xs hover:border-accent/40 hover:text-accent",
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
      {count !== undefined && <span className={clsx("num text-[11px]", active ? "text-white/85" : "text-ink-3")}>{count}</span>}
    </button>
  );
}
