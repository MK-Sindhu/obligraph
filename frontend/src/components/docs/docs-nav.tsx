"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DocMeta } from "@/lib/docs";

function NavList({ docs, groups }: { docs: DocMeta[]; groups: { key: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const items = docs.filter((d) => d.group === g.key);
        if (!items.length) return null;
        return (
          <div key={g.key}>
            <p className="mb-1.5 px-3 text-[10.5px] font-extrabold uppercase tracking-[0.09em] text-accent">{g.label}</p>
            <ul className="space-y-0.5">
              {items.map((d) => {
                const active = pathname === d.href;
                return (
                  <li key={d.slug}>
                    <Link
                      href={d.href}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "block rounded-[10px] px-3 py-1.5 text-[13.5px] leading-snug transition-colors",
                        active ? "bg-accent-wash font-semibold text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                      )}
                    >
                      {d.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** Grouped docs navigation: a card on wide screens, a collapsible menu on narrow ones. */
export function DocsNav({ docs, groups }: { docs: DocMeta[]; groups: { key: string; label: string }[] }) {
  return (
    <>
      <nav aria-label="Docs" className="hidden lg:block">
        <NavList docs={docs} groups={groups} />
      </nav>
      <details className="group lg:hidden">
        <summary className="flex h-10 cursor-pointer list-none items-center justify-between rounded-[12px] border border-line bg-surface px-4 text-[13.5px] font-semibold text-ink">
          Browse the docs
          <ChevronDown size={16} className="text-ink-3 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <nav aria-label="Docs" className="mt-3">
          <NavList docs={docs} groups={groups} />
        </nav>
      </details>
    </>
  );
}
