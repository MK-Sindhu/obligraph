"use client";

import clsx from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Click-to-open menu panel anchored under its trigger. Closes on outside click,
 * Escape, or when an item calls `close()`.
 */
export function Popover({
  trigger,
  children,
  align = "end",
  className,
  panelClassName,
}: {
  trigger: (props: { open: boolean; toggle: () => void; "aria-expanded": boolean }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  className?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={clsx("relative", className)}>
      {trigger({ open, toggle: () => setOpen((o) => !o), "aria-expanded": open })}
      {open && (
        <div
          className={clsx(
            "absolute top-[calc(100%+10px)] z-50 min-w-56 animate-[rise-in_140ms_ease-out] rounded-[22px] border border-[var(--card-edge)] bg-surface-grad p-1.5 shadow-pop",
            align === "end" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  icon,
  active,
  danger,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  active?: boolean;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-left text-[13px] transition-colors",
        danger ? "text-danger hover:bg-danger-bg" : "text-ink hover:bg-surface-2",
        active && "bg-accent-wash",
        className,
      )}
    >
      {icon && <span className="shrink-0 text-ink-3">{icon}</span>}
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}
