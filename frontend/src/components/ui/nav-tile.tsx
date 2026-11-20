"use client";

import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Navigation tile from the reference kit: a white rounded square holding a thin outline glyph,
 * with the label underneath ("stack"), or beside it ("row"). The current page's tile is filled
 * steel blue with a white glyph; the label stays dark text so it reads on any background.
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
  /** e.g. a CountBadge, pinned to the tile's top-right corner. */
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
        "group flex min-w-0 select-none rounded-[14px] transition-colors duration-150",
        stack ? "flex-col items-center gap-1.5 px-0.5 py-1 text-center text-[11.5px]" : "items-center gap-3 px-1.5 py-1 text-[13.5px]",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "relative flex shrink-0 items-center justify-center border transition-[background-color,border-color,color] duration-150 [&_svg]:stroke-[1.6]",
          stack ? "h-[52px] w-[52px] rounded-[14px]" : "h-9 w-9 rounded-[11px]",
          active
            ? "border-transparent bg-steel text-white"
            : "border-line bg-surface text-ink-2 shadow-xs group-hover:border-primary group-hover:text-primary",
        )}
      >
        {icon}
        {badge && <span className="absolute -right-1.5 -top-1.5">{badge}</span>}
      </span>
      <span
        className={clsx(
          "min-w-0 leading-tight",
          stack ? "line-clamp-2" : "truncate",
          active ? "font-bold text-on-canvas" : "font-semibold text-on-canvas-2 group-hover:text-on-canvas",
        )}
      >
        {label}
      </span>
    </Link>
  );
}
