import clsx from "clsx";
import type { ComponentProps } from "react";

export type GlassVariant = "default" | "strong" | "subtle";

const variantClass: Record<GlassVariant, string> = {
  default: "glass",
  strong: "glass-strong",
  subtle: "glass-subtle",
};

const radiusClass = {
  lg: "rounded-card-lg",
  md: "rounded-card",
  tile: "rounded-tile",
  pill: "rounded-full",
  none: "",
};

/** Class for a frosted glass surface (see `.glass*` in globals.css). */
export function glassClass(variant: GlassVariant = "default", radius: keyof typeof radiusClass = "md", extra?: string) {
  return clsx(variantClass[variant], radiusClass[radius], extra);
}

type GlassPanelProps = {
  as?: "div" | "section" | "article" | "aside" | "figure" | "header" | "nav";
  variant?: GlassVariant;
  radius?: keyof typeof radiusClass;
} & Omit<ComponentProps<"div">, "ref">;

/**
 * Frosted glass surface: translucent fill, backdrop blur, a hairline border and a faint top
 * highlight. It needs something behind it (see BackdropBlobs). Use it for chrome, overlays and
 * marketing cards; keep dense tables and long reading text on solid soft cards.
 */
export function GlassPanel({ as: Tag = "div", variant = "default", radius = "md", className, children, ...rest }: GlassPanelProps) {
  return (
    <Tag className={glassClass(variant, radius, className)} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * Large, very soft blue / indigo / cyan colour fields fixed behind the canvas, so glass has
 * something to frost. Subtle in the app, stronger on marketing pages; deep glows in dark mode.
 */
export function BackdropBlobs({ intensity = "app" }: { intensity?: "app" | "auth" | "marketing" }) {
  const opacity = intensity === "marketing" ? 1 : intensity === "auth" ? 0.75 : 0.5;
  return (
    <div aria-hidden="true" className="backdrop-blobs pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ opacity }}>
      <div
        className="absolute -left-[10%] -top-[18%] h-[70vmax] w-[70vmax] rounded-full"
        style={{ background: "radial-gradient(closest-side, var(--blob-blue), transparent)" }}
      />
      <div
        className="absolute -right-[16%] top-[8%] h-[62vmax] w-[62vmax] rounded-full"
        style={{ background: "radial-gradient(closest-side, var(--blob-indigo), transparent)" }}
      />
      <div
        className="absolute -bottom-[28%] left-[22%] h-[64vmax] w-[64vmax] rounded-full"
        style={{ background: "radial-gradient(closest-side, var(--blob-cyan), transparent)" }}
      />
    </div>
  );
}
