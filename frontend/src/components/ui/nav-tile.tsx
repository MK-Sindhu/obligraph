"use client";

import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Navigation tile: a rounded-square tile with an icon above a small label ("stack"), or a
 * soft pill with the icon beside the label ("row"). The active tile is raised white with a
 * blue icon; inactive tiles are flat with a faint outline.
 */
export function NavTile({
  href,
  icon,
  label,
  active,
  layout = "stack",
  badge,
  title,
  onClick,
  className,
}: {
  href: string;
  icon: ReactNode;
  label: ReactNode;
  active?: boolean;
  layout?: "stack" | "row";
  /** e.g. a CountBadge, pinned to the top-right corner. */
  badge?: ReactNode;
  title?: string;
  onClick?: () => void;
  className?: string;
}) {
  const stack = layout === "stack";
  return (
    <Link
      href={href}
      onClick={onClick}
      title={title}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "group relative flex min-w-0 select-none transition-[background-color,box-shadow,color,border-color] duration-150",
        stack
          ? "h-[66px] flex-col items-center justify-center gap-1 rounded-[20px] px-1.5 text-center text-[11.5px]"
          : "h-11 items-center gap-3 rounded-full px-4 text-[13.5px]",
        active
          ? "soft-sm font-medium text-ink"
          : "border border-line/90 text-ink-3 hover:border-transparent hover:bg-surface hover:text-ink hover:shadow-raised-xs",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "flex shrink-0 items-center justify-center transition-colors",
          active ? "text-accent" : "text-ink-3 group-hover:text-accent",
        )}
      >
        {icon}
      </span>
      <span className={clsx("min-w-0 leading-tight", stack ? "line-clamp-2" : "truncate")}>{label}</span>
      {badge && <span className={clsx("absolute", stack ? "right-2 top-2" : "right-3 top-1/2 -translate-y-1/2")}>{badge}</span>}
    </Link>
  );
}
