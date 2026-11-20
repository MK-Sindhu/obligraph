import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cardClass } from "@/components/ui/styles";
import { DOC_GROUPS, docIndex } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Docs",
  description: "How Obligraph works: getting started, concepts, everyday use, administration, deployment and security.",
  alternates: { canonical: "/docs" },
  openGraph: { title: "Obligraph docs", url: "/docs" },
};

export default function DocsHome() {
  const docs = docIndex();
  return (
    <div>
      <header className="pb-6">
        <p className="label-caps text-[12px] text-accent-deep!">Docs</p>
        <h1 className="display mt-2 text-[32px] font-extrabold leading-tight text-on-canvas">How Obligraph works</h1>
        <p className="mt-2 max-w-xl text-[15px] text-on-canvas-2">Setup, concepts, daily use and deployment, in detail.</p>
      </header>
      <div className="grid gap-5 md:grid-cols-2">
        {DOC_GROUPS.map((g) => {
          const items = docs.filter((d) => d.group === g.key);
          if (!items.length) return null;
          return (
            <section key={g.key} aria-labelledby={`g-${g.key}`} className={cardClass("raised", "tile", "relative px-6 pb-5 pt-5")}>
              <h2 id={`g-${g.key}`} className="label-caps text-[12.5px]">
                {g.label}
              </h2>
              <ul className="mt-3 space-y-1">
                {items.map((d) => (
                  <li key={d.slug}>
                    <Link href={d.href} className="group flex items-start gap-3 rounded-[12px] px-2 py-2 hover:bg-surface-2">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-ink group-hover:text-accent">{d.title}</span>
                        <span className="mt-0.5 line-clamp-1 block text-[12.5px] text-ink-3">{d.description}</span>
                      </span>
                      <ArrowRight size={15} className="mt-1 shrink-0 text-ink-4 group-hover:text-accent" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
