"use client";

import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

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

type SoftCardProps = {
  as?: "div" | "section" | "article" | "aside" | "header" | "figure";
  elevation?: Elevation;
  radius?: CardRadius;
} & Omit<ComponentProps<"div">, "ref">;

/**
 * Soft card: a very light surface with a faint top-left to bottom-right gradient,
 * a large radius and the dual light/dark shadow. `inset` gives the pressed-in well.
 */
export function SoftCard({ as: Tag = "div", elevation = "raised", radius = "md", className, children, ...rest }: SoftCardProps) {
  return (
    <Tag className={softCardClass(elevation, radius, className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Card with an optional header row (title, meta, actions) used for most page sections. */
export function Panel({
  title,
  meta,
  actions,
  icon,
  children,
  className,
  bodyClassName,
  headerClassName,
  id,
  elevation = "raised",
}: {
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  /** Optional icon tile shown before the title. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  id?: string;
  elevation?: Elevation;
}) {
  return (
    <section id={id} className={softCardClass(elevation, "md", clsx("flex min-w-0 flex-col", className))}>
      {(title || actions) && (
        <header className={clsx("flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-6 pb-3 pt-5", headerClassName)}>
          <div className="flex min-w-0 items-center gap-3">
            {icon}
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              {title && <h2 className="display text-[16px] leading-snug text-ink">{title}</h2>}
              {meta && <span className="text-[12px] text-ink-3">{meta}</span>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx("min-w-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

/** KPI tile: caption, big number and an optional note, with an optional icon tile. */
export function StatTile({
  label,
  value,
  note,
  icon,
  tone,
  children,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  icon?: ReactNode;
  tone?: "danger";
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex min-w-0 flex-col", className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[12.5px] font-medium text-ink-2">{label}</span>
        {icon}
      </div>
      <span className={clsx("figure mt-2 block text-[34px] leading-none", tone === "danger" ? "text-danger" : "text-ink")}>{value}</span>
      {note && <span className="mt-2 block text-[12px] text-ink-3">{note}</span>}
      {children}
    </div>
  );
}
