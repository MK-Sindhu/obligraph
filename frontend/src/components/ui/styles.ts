// Class helpers for the design system. No "use client": server components can call these.

import clsx from "clsx";

// ---------------------------------------------------------------- buttons

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "quiet-danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold select-none " +
  "transition-[background-color,color,border-color,box-shadow] duration-150 ease-out " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  // Solid azure with white text (primary-fill keeps >= 4.5:1).
  primary: "bg-primary-fill text-on-accent border border-transparent hover:bg-primary-hover",
  secondary: "bg-surface text-ink border border-line-strong hover:border-primary hover:text-accent",
  ghost: "text-ink-2 border border-transparent hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger-fill text-white border border-transparent hover:brightness-110",
  "quiet-danger": "text-danger border border-transparent hover:bg-danger-bg",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[12.5px]",
  md: "h-10 px-4 text-[13.5px]",
  lg: "h-12 px-6 text-[14.5px]",
};

/** Solid blue (or quiet) button with a small radius. Add `uppercase tracking-wide` for short labels. */
export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra?: string) {
  return clsx(base, variants[variant], sizes[size], extra);
}

// ---------------------------------------------------------------- icon tiles

/**
 * accent: white tile, azure outline glyph · soft: white tile, slate glyph ·
 * inset: tinted tile · plain: glyph only · selected: steel-blue tile, white glyph.
 */
export type IconTileTone = "accent" | "soft" | "inset" | "plain" | "selected";
export type IconTileSize = "xs" | "sm" | "md" | "lg" | "xl";

const tileSize: Record<IconTileSize, string> = {
  xs: "h-7 w-7 rounded-[9px]",
  sm: "h-8 w-8 rounded-[10px]",
  md: "h-10 w-10 rounded-[12px]",
  lg: "h-12 w-12 rounded-[14px]",
  xl: "h-14 w-14 rounded-[16px]",
};

const tileTone: Record<IconTileTone, string> = {
  accent: "bg-surface text-primary border border-line",
  soft: "bg-surface text-ink-2 border border-line",
  inset: "bg-surface-2 text-ink-3",
  plain: "text-ink-3",
  selected: "bg-steel text-white border border-transparent",
};

/** Class for a rounded-square icon tile: white with a thin outline glyph (selected: steel blue). */
export function iconTileClass(tone: IconTileTone = "accent", size: IconTileSize = "md", extra?: string) {
  return clsx("inline-flex shrink-0 items-center justify-center [&_svg]:stroke-[1.6]", tileSize[size], tileTone[tone], extra);
}

// ---------------------------------------------------------------- cards

/** raised: card on the canvas · raised-xs: card inside a card · inset: flat tint · flat: hairline only. */
export type Elevation = "raised" | "raised-sm" | "raised-xs" | "inset" | "flat";
export type CardRadius = "lg" | "md" | "tile" | "sm";

const elevationClass: Record<Elevation, string> = {
  raised: "card",
  "raised-sm": "card",
  "raised-xs": "card-xs",
  inset: "tint",
  flat: "bg-surface border border-line",
};

const radiusClass: Record<CardRadius, string> = {
  lg: "rounded-card-lg",
  md: "rounded-card",
  tile: "rounded-tile",
  sm: "rounded-[16px]",
};

/** Class for a flat white card (or a tinted area), for use on links and other elements. */
export function cardClass(elevation: Elevation = "raised", radius: CardRadius = "md", extra?: string) {
  return clsx(elevationClass[elevation], radiusClass[radius], extra);
}

