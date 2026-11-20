"use client";

import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { cardClass, type CardRadius, type Elevation } from "./styles";

export { cardClass };
export type { CardRadius, Elevation };

/**
 * Small azure tab in a card's top-right corner. It marks the card that matters most in a view
 * (the sign-in card, the request being decided, the figure a page is about); with a label it
 * names what the card is (e.g. "Sample data" on product screenshots). The card needs `relative`.
 */
export function CornerTab({ label, className }: { label?: ReactNode; className?: string }) {
  if (!label) return <span aria-hidden="true" className={clsx("corner-tab", className)} />;
  return (
    <span
      className={clsx(
        "absolute -right-px -top-px rounded-bl-[10px] rounded-tr-[inherit] bg-primary-fill px-3 py-1 text-[10.5px] font-bold uppercase leading-none tracking-[0.06em] text-white",
        className,
      )}
    >
      {label}
    </span>
  );
}

type CardProps = {
  as?: "div" | "section" | "article" | "aside" | "header" | "figure";
  elevation?: Elevation;
  radius?: CardRadius;
} & Omit<ComponentProps<"div">, "ref">;

/** Flat white card with one light shadow; `inset` gives a flat tinted area. */
export function Card({ as: Tag = "div", elevation = "raised", radius = "md", className, children, ...rest }: CardProps) {
  return (
    <Tag className={cardClass(elevation, radius, className)} {...rest}>
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
  tab,
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
  /** Corner tab: true for the plain accent, or a short label. */
  tab?: boolean | ReactNode;
}) {
  return (
    <section id={id} className={cardClass(elevation, "md", clsx("relative flex min-w-0 flex-col", className))}>
      {tab && <CornerTab label={tab === true ? undefined : tab} />}
      {(title || actions) && (
        <header className={clsx("flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-6 pb-3 pt-5", tab && actions && "pr-20", headerClassName)}>
          <div className="flex min-w-0 items-center gap-3">
            {icon}
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              {title && <h2 className="display text-[16px] font-bold leading-snug text-ink">{title}</h2>}
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
      <span className={clsx("figure mt-2 block text-[34px] leading-none", tone === "danger" ? "text-negative-ink" : "text-accent")}>{value}</span>
      {note && <span className="mt-2 block text-[12px] text-ink-3">{note}</span>}
      {children}
    </div>
  );
}
