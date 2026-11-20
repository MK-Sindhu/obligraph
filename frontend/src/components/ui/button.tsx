"use client";

import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Spinner } from "./states";

/**
 * Pill buttons.
 * - primary: the blue gradient with white text and a soft blue glow (one per view, ideally)
 * - secondary: a soft raised pill with a thin outline
 * - ghost: text-only until hovered
 * - danger / quiet-danger: destructive actions
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "quiet-danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium select-none " +
  "transition-[box-shadow,background-color,color,border-color,transform,filter] duration-150 ease-out " +
  "disabled:pointer-events-none disabled:opacity-55 disabled:shadow-none active:translate-y-px";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent-grad-text text-on-accent shadow-glow hover:shadow-[var(--glow-hover)] hover:brightness-[1.06] border border-transparent",
  secondary:
    "bg-surface-grad text-ink border border-line-strong/80 shadow-raised-xs hover:text-accent hover:border-accent/40 active:shadow-inset-sm",
  ghost: "text-ink-2 hover:text-ink hover:bg-surface-2 border border-transparent",
  danger: "bg-danger-fill text-white shadow-[0_10px_22px_rgb(201_55_74/0.3)] hover:brightness-110 border border-transparent",
  "quiet-danger": "text-danger hover:bg-danger-bg border border-transparent",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-[12.5px]",
  md: "h-10 px-5 text-[13.5px]",
  lg: "h-12 px-7 text-[14.5px]",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra?: string) {
  return clsx(base, variants[variant], sizes[size], extra);
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={size === "sm" ? 12 : 14} /> : icon}
      {children}
    </button>
  );
}

/** Alias: every button in the system is a pill. */
export const PillButton = Button;

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

export function ButtonLink({ variant = "secondary", size = "md", icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------- icon buttons and tiles

export type IconTileTone = "accent" | "soft" | "inset" | "plain";
export type IconTileSize = "xs" | "sm" | "md" | "lg";

const tileSize: Record<IconTileSize, string> = {
  xs: "h-7 w-7 rounded-[10px]",
  sm: "h-8 w-8 rounded-[11px]",
  md: "h-10 w-10 rounded-[14px]",
  lg: "h-12 w-12 rounded-[16px]",
};

const tileTone: Record<IconTileTone, string> = {
  accent: "bg-accent-grad-diag text-white shadow-glow-sm",
  soft: "bg-surface-grad text-accent border border-[var(--card-edge)] shadow-raised-xs",
  inset: "bg-surface-2 text-ink-3 shadow-inset-sm",
  plain: "text-ink-3",
};

/** Class for a rounded-square icon tile (gradient tile with a white glyph, or a soft raised one). */
export function iconTileClass(tone: IconTileTone = "accent", size: IconTileSize = "md", extra?: string) {
  return clsx("inline-flex shrink-0 items-center justify-center", tileSize[size], tileTone[tone], extra);
}

/** Decorative icon tile. Use IconButton (or iconTileClass on a button) when it's interactive. */
export function IconTile({
  children,
  tone = "accent",
  size = "md",
  className,
  style,
}: {
  children: ReactNode;
  tone?: IconTileTone;
  size?: IconTileSize;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span aria-hidden="true" className={iconTileClass(tone, size, className)} style={style}>
      {children}
    </span>
  );
}

interface IconButtonProps extends ComponentProps<"button"> {
  label: string;
  size?: "sm" | "md";
  /**
   * plain: round, appears on hover (default) · soft: raised tile · accent: gradient tile.
   */
  tone?: "plain" | "soft" | "accent";
}

export function IconButton({ label, size = "md", tone = "plain", className, children, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center transition-[box-shadow,background-color,color,transform] duration-150 disabled:pointer-events-none disabled:opacity-40 active:translate-y-px",
        tone === "plain" && "rounded-full text-ink-3 hover:bg-surface-hi hover:text-accent hover:shadow-raised-xs",
        tone === "soft" &&
          "rounded-[14px] border border-line-strong/70 bg-surface-grad text-ink-2 shadow-raised-xs hover:text-accent active:shadow-inset-sm",
        tone === "accent" && "rounded-[14px] bg-accent-grad-diag text-white shadow-glow-sm hover:shadow-glow",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
        tone !== "plain" && size === "sm" && "rounded-[11px]",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
