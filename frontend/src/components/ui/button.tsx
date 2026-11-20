"use client";

import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Spinner } from "./states";
import { buttonClass, iconTileClass, type ButtonSize, type ButtonVariant, type IconTileSize, type IconTileTone } from "./styles";

export { buttonClass, iconTileClass };
export type { ButtonSize, ButtonVariant, IconTileSize, IconTileTone };

/**
 * Buttons.
 * - primary: solid azure with white text (one per view, ideally)
 * - secondary: white with a thin outline
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

/** @deprecated Alias kept for existing imports. */
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
  /** plain: glyph until hovered (default) · soft: round white button · accent: round white, azure glyph. */
  tone?: "plain" | "soft" | "accent";
}

/** Round icon button (white circle with a coloured glyph). */
export function IconButton({ label, size = "md", tone = "plain", className, children, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,border-color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-40",
        tone === "plain" && "text-ink-3 hover:bg-surface-2 hover:text-accent",
        tone === "soft" && "border border-line bg-surface text-ink-2 shadow-xs hover:border-primary hover:text-accent",
        tone === "accent" && "border border-line bg-surface text-primary shadow-xs hover:border-primary",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
