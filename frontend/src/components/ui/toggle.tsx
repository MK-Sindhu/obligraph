"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Rounded-rect switch. ON: the blue gradient track with white "ON" text; OFF: a pressed-in
 * track with "OFF". The knob is a white embossed block that can carry an icon.
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
          "relative inline-flex shrink-0 items-center border transition-[background-color,border-color,box-shadow] duration-200",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
          md ? "h-[30px] w-[60px] rounded-[11px]" : "h-[24px] w-[46px] rounded-[9px]",
          checked
            ? "border-transparent bg-accent-grad shadow-glow-sm"
            : "border-line-strong bg-surface-2 shadow-inset-sm",
        )}
      >
        {state && (
          <span
            className={clsx(
              "absolute text-[9.5px] font-semibold tracking-[0.08em]",
              checked ? "left-[9px] text-white" : "right-[8px] text-ink-3",
            )}
          >
            {checked ? "ON" : "OFF"}
          </span>
        )}
        <span
          className={clsx(
            "absolute flex items-center justify-center bg-surface-hi bg-surface-grad shadow-knob transition-transform duration-200 ease-out",
            md ? "left-[3px] h-[22px] w-[24px] rounded-[8px]" : "left-[2px] h-[18px] w-[20px] rounded-[7px]",
            checked ? (md ? "translate-x-[28px]" : "translate-x-[22px]") : "translate-x-0",
            checked ? "text-accent" : "text-ink-3",
          )}
        >
          {knobIcon}
        </span>
      </span>
      <span className={labelHidden ? "sr-only" : "text-ink-2"}>{label}</span>
    </label>
  );
}
