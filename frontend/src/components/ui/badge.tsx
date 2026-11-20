"use client";

import clsx from "clsx";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "solid" | "ok" | "warn" | "danger" | "outline" | "dashed";

const toneClass: Record<BadgeTone, string> = {
  neutral: "bg-surface-3/80 text-ink-2",
  accent: "bg-accent-wash text-accent",
  solid: "bg-primary-fill text-white",
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
        tone === "solid" ? "bg-primary-fill text-white" : "bg-surface-3 text-ink-2",
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
        "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[12.5px] font-semibold transition-[background-color,color,border-color] duration-150",
        active
          ? "border border-transparent bg-primary-fill text-white"
          : "border border-line-strong bg-surface text-ink-2 hover:border-primary hover:text-accent",
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

/**
 * Small round badge with a white arrow, from the reference kit: red pointing up for something
 * that went wrong or needs attention, blue for something to review or that eased. Pair it with
 * text; the label is announced to screen readers.
 */
export function ArrowBadge({
  direction,
  tone = direction === "up" ? "negative" : "primary",
  label,
  size = 28,
  className,
}: {
  direction: "up" | "down" | "right";
  tone?: "negative" | "primary" | "positive";
  label: string;
  size?: number;
  className?: string;
}) {
  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : ArrowRight;
  const bg = tone === "negative" ? "bg-negative" : tone === "positive" ? "bg-positive" : "bg-primary";
  return (
    <span role="img" aria-label={label} className={clsx("inline-flex shrink-0 items-center justify-center rounded-full text-white", bg, className)} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.55)} strokeWidth={2.5} aria-hidden="true" />
    </span>
  );
}
