"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { initials } from "@/lib/format";

// Primitives live in their own modules; re-exported here so existing imports keep working.
export { Card, Panel, StatTile, cardClass } from "./card";
export { FilterSelect, InsetField, Input, Label, SearchField, Select, Textarea, UnderlineField } from "./field";
export { SegmentedControl as Segmented, SegmentedControl, Tabs } from "./tabs";
export { Toggle } from "./toggle";

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[11.5px] font-extrabold uppercase tracking-[0.08em] text-accent-deep">{eyebrow}</div>}
        <h1 className="display text-[28px] font-extrabold leading-[1.12] text-on-canvas sm:text-[32px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-on-canvas-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

/** Initials in a white disc. */
export function Avatar({ name, size = 24, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      title={name}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-surface font-bold text-accent",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.38) }}
    >
      {initials(name)}
    </span>
  );
}

/** Small chip for topics, entity types and other labels. */
export function Tag({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex max-w-full items-center truncate rounded-full border border-line bg-surface-2 px-2.5 py-[3px] text-[11.5px] text-ink-2",
        className,
      )}
    >
      {children}
    </span>
  );
}

const pageBtn =
  "inline-flex h-8 items-center gap-1 rounded-[9px] border border-line-strong bg-surface px-3 text-[12.5px] font-semibold text-ink-2 transition-colors hover:border-primary hover:text-accent disabled:pointer-events-none disabled:opacity-40";

export function Pagination({
  total,
  limit,
  offset,
  onChange,
  noun = "items",
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
  noun?: string;
}) {
  if (total === 0) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-5 pt-3 text-[12.5px] text-ink-3">
      <span className="num">
        {offset + 1}–{Math.min(offset + limit, total)} of {total} {noun}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onChange(Math.max(0, offset - limit))} className={pageBtn}>
          <ChevronLeft size={14} aria-hidden="true" /> Previous
        </button>
        <span className="num px-1 text-ink-2">
          {page} / {pages}
        </span>
        <button type="button" disabled={page >= pages} onClick={() => onChange(offset + limit)} className={pageBtn}>
          Next <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** Definition-list row used in detail panels. */
export function Meta({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={clsx("min-w-0", className)}>
      <dt className="mb-1 text-[11.5px] text-ink-3">{label}</dt>
      <dd className="text-[13.5px] text-ink">{children}</dd>
    </div>
  );
}
