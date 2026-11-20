"use client";

import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Spinner } from "./states";
import { buttonClass, iconTileClass, type ButtonSize, type ButtonVariant, type IconTileSize, type IconTileTone } from "./styles";

export { buttonClass, iconTileClass };
export type { ButtonSize, ButtonVariant, IconTileSize, IconTileTone };

/**
 * Pill buttons.
 * - primary: the blue gradient with white text and a soft blue glow (one per view, ideally)
 * - secondary: a soft raised pill with a thin outline
 * - ghost: text-only until hovered
 * - danger / quiet-danger: destructive actions
 */
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
