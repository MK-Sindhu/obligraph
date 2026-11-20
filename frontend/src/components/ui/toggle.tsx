"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Switch: a pill track (azure when on) with a round white knob that can carry an icon.
 * A native checkbox (role="switch") underneath keeps keyboard and screen-reader behaviour.
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  size = "md",
  showState,
  knobIcon,
  labelHidden,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  size?: "sm" | "md";
  /** Show ON/OFF inside the track (default: on for md). */
  showState?: boolean;
  /** Glyph drawn on the knob, e.g. a sun/moon for the theme switch. */
  knobIcon?: ReactNode;
  /** Keep the label for assistive tech only. */
  labelHidden?: boolean;
  className?: string;
}) {
  const md = size === "md";
  const state = showState ?? md;
  return (
    <label
      className={clsx(
        "inline-flex select-none items-center gap-2.5 text-[13px]",
        disabled ? "opacity-55" : "cursor-pointer",
        className,
      )}
    >
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className={clsx(
          "relative inline-flex shrink-0 items-center rounded-full border transition-[background-color,border-color] duration-200",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary",
          md ? "h-[26px] w-[46px]" : "h-[22px] w-[38px]",
          checked ? "border-transparent bg-primary-fill" : "border-line-strong bg-surface-3",
        )}
      >
        {state && <span className="sr-only">{checked ? "On" : "Off"}</span>}
        <span
          className={clsx(
            "absolute left-[2px] flex items-center justify-center rounded-full bg-white shadow-xs transition-transform duration-200 ease-out",
            md ? "h-5 w-5" : "h-4 w-4",
            checked ? (md ? "translate-x-[20px]" : "translate-x-[16px]") : "translate-x-0",
            checked ? "text-primary-fill" : "text-ink-3",
          )}
        >
          {knobIcon}
        </span>
      </span>
      <span className={labelHidden ? "sr-only" : "text-ink-2"}>{label}</span>
    </label>
  );
}
