"use client";

import clsx from "clsx";
import { CornerDownLeft, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import type { DocMeta } from "@/lib/docs";

interface Hit {
  key: string;
  href: string;
  title: string;
  context: string;
  score: number;
}

/** Searches page titles, headings and descriptions in the browser; no server round trip. */
function search(docs: DocMeta[], q: string): Hit[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const has = (s: string) => terms.every((t) => s.toLowerCase().includes(t));
  const hits: Hit[] = [];
  for (const d of docs) {
    if (has(d.title)) hits.push({ key: d.slug, href: d.href, title: d.title, context: d.groupLabel, score: 3 });
    else if (has(d.description)) hits.push({ key: d.slug, href: d.href, title: d.title, context: d.description, score: 1 });
    for (const h of d.headings) {
      if (has(h.text)) hits.push({ key: `${d.slug}#${h.id}`, href: `${d.href}#${h.id}`, title: h.text, context: d.title, score: 2 });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 8);
}

export function DocsSearch({ docs }: { docs: DocMeta[] }) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const hits = useMemo(() => search(docs, q), [docs, q]);
  const open = q.trim().length > 0;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && hits[active]) {
      e.preventDefault();
      router.push(hits[active].href);
      setQ("");
    } else if (e.key === "Escape") {
      setQ("");
    }
  }

  return (
    <div className="relative">
      <label htmlFor={`${id}-q`} className="sr-only">
        Search the docs
      </label>
      <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
      <input
        id={`${id}-q`}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open && hits[active] ? `${id}-opt-${active}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        placeholder="Search the docs"
        className="field h-10 pl-10 text-[13.5px]"
      />
      {open && (
        <div className="overlay absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-[16px] p-1.5">
          {hits.length ? (
            <ul id={`${id}-list`} role="listbox" aria-label="Search results">
              {hits.map((h, i) => (
                <li key={h.key} id={`${id}-opt-${i}`} role="option" aria-selected={i === active}>
                  <Link
                    href={h.href}
                    onClick={() => setQ("")}
                    onMouseEnter={() => setActive(i)}
                    className={clsx("flex items-center gap-3 rounded-[10px] px-3 py-2", i === active ? "bg-accent-wash" : "hover:bg-surface-2")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">{h.title}</span>
                      <span className="block truncate text-[12px] text-ink-3">{h.context}</span>
                    </span>
                    {i === active && <CornerDownLeft size={14} className="shrink-0 text-ink-3" aria-hidden="true" />}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p id={`${id}-list`} className="px-3 py-3 text-[13px] text-ink-3">
              Nothing matches &ldquo;{q.trim()}&rdquo;.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
