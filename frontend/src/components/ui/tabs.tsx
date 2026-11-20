"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

const track = "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-[12px] border border-line bg-surface p-1 shadow-xs";

function segClass(active: boolean, size: "sm" | "md") {
  return clsx(
    "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] font-semibold transition-[background-color,color] duration-150",
    size === "sm" ? "h-7 px-3 text-[12px]" : "h-8 px-3.5 text-[13px]",
    active ? "bg-primary-fill text-white" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
  );
}

/** Soft segmented control (radio group): a pressed-in track with a raised active segment. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={clsx(track, className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={segClass(value === o.value, size)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Tabs in the same segmented style. The selected tab is owned by the caller; panels should use
 * `id={`${idPrefix}-panel-${value}`}` and `aria-labelledby={`${idPrefix}-tab-${value}`}`.
 */
export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
  idPrefix,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: ReactNode }[];
  label: string;
  idPrefix: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={clsx(track, className)}>
      {tabs.map((t) => {
        const selected = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${t.value}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${t.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => {
              const i = tabs.findIndex((x) => x.value === value);
              if (e.key === "ArrowRight") onChange(tabs[(i + 1) % tabs.length].value);
              if (e.key === "ArrowLeft") onChange(tabs[(i - 1 + tabs.length) % tabs.length].value);
            }}
            className={segClass(selected, size)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
