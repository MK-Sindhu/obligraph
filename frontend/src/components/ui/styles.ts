// Class helpers for the design system. No "use client": server components can call these.

import clsx from "clsx";

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

export type Elevation = "raised" | "raised-sm" | "raised-xs" | "inset" | "flat";
export type CardRadius = "lg" | "md" | "tile" | "sm";

const elevationClass: Record<Elevation, string> = {
  raised: "soft",
  "raised-sm": "soft-sm",
  "raised-xs": "soft-xs",
  inset: "soft-inset",
  flat: "bg-surface border border-line",
};

const radiusClass: Record<CardRadius, string> = {
  lg: "rounded-card-lg",
  md: "rounded-card",
  tile: "rounded-tile",
  sm: "rounded-[18px]",
};

/** Class for an extruded (or pressed-in) surface, for use on links and other elements. */
export function softCardClass(elevation: Elevation = "raised", radius: CardRadius = "md", extra?: string) {
  return clsx(elevationClass[elevation], radiusClass[radius], extra);
}

