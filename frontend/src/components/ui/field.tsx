"use client";

import clsx from "clsx";
import { Search } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-[12.5px] font-medium text-ink-2">
      <span>{children}</span>
      {hint && <span className="font-normal text-ink-3">{hint}</span>}
    </label>
  );
}

/** Pressed-in input with a thin outline (`.field`). */
export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={clsx("field", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={clsx("field", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <select className={clsx("field", className)} {...rest}>
      {children}
    </select>
  );
}

/**
 * Inset field with a leading icon and an optional trailing slot (button, unit, shortcut).
 * `pill` rounds it fully for search bars and filter rows.
 */
export function InsetField({
  icon,
  trailing,
  pill,
  size = "md",
  className,
  inputClassName,
  label,
  ...rest
}: Omit<ComponentProps<"input">, "size"> & {
  icon?: ReactNode;
  trailing?: ReactNode;
  pill?: boolean;
  size?: "sm" | "md";
  /** Accessible label, rendered visually hidden. */
  label?: string;
  inputClassName?: string;
}) {
  return (
    <label className={clsx("relative block min-w-0", className)}>
      {label && <span className="sr-only">{label}</span>}
      {icon && (
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true">
          {icon}
        </span>
      )}
      <input
        className={clsx(
          "field",
          size === "sm" ? "h-9 text-[13px]" : "h-10",
          pill && "rounded-full!",
          icon && "pl-10",
          trailing && "pr-11",
          inputClassName,
        )}
        {...rest}
      />
      {trailing && <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</span>}
    </label>
  );
}

/** Pill search box. */
export function SearchField({ className, ...rest }: Omit<ComponentProps<typeof InsetField>, "icon" | "pill">) {
  return <InsetField type="search" icon={<Search size={15} />} pill size="sm" className={className} {...rest} />;
}

/**
 * Underline field from the sign-in card: a grey rule, a label above and a trailing icon
 * (or a button such as a show-password toggle) at the right end of the rule.
 */
export function UnderlineField({
  id,
  label,
  icon,
  trailing,
  className,
  ...rest
}: ComponentProps<"input"> & { id: string; label: ReactNode; icon?: ReactNode; trailing?: ReactNode }) {
  return (
    <div className={clsx("group relative", className)}>
      <label htmlFor={id} className="block text-[12.5px] font-medium text-ink-3 transition-colors group-focus-within:text-accent">
        {label}
      </label>
      <div className="relative">
        <input id={id} className="field-line text-[14.5px]" {...rest} />
        <span className="absolute bottom-0 right-0 top-0 flex items-center text-ink-3 group-focus-within:text-accent">
          {trailing ?? (icon && <span aria-hidden="true">{icon}</span>)}
        </span>
      </div>
    </div>
  );
}

/** Compact pill select used in filter bars: the label sits inside the control. */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel = "All",
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel?: string;
  className?: string;
}) {
  const active = !!value;
  return (
    <label className={clsx("relative inline-flex min-w-0 items-center", className)}>
      <span
        className={clsx(
          "pointer-events-none absolute left-3.5 text-[11.5px] font-medium",
          active ? "text-accent" : "text-ink-3",
        )}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx("field h-9 w-full rounded-full! text-[13px]", active && "border-accent! bg-accent-wash! font-medium")}
        style={{ paddingLeft: `${Math.round(label.length * 6.6 + 22)}px` }}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
