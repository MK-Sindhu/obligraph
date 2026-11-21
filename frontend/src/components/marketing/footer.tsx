import Link from "next/link";
import { Wordmark } from "@/components/brand";

const COLUMNS = [
  {
    title: "Explore",
    links: [
      { href: "/product", label: "Product" },
      { href: "/solutions", label: "Solutions" },
      { href: "/security", label: "Security" },
      { href: "/docs", label: "Docs" },
    ],
  },
  {
    title: "Get in touch",
    links: [
      { href: "/contact", label: "Request a demo" },
      { href: "/privacy", label: "Privacy notice" },
      { href: "/login", label: "Sign in" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="mx-auto w-full max-w-[1200px] px-4 pb-10 sm:px-8">
      <div className="card rounded-card-lg px-6 py-10 sm:px-10">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))] md:gap-10">
          <div className="col-span-2 md:col-span-1">
            <Wordmark />
            <p className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-ink-2">
              Circulars, obligations, policy gaps and the work that closes them.
            </p>
          </div>
          {COLUMNS.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-accent">{c.title}</p>
              <ul className="mt-3 space-y-2">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="rounded-[8px] text-[14px] text-ink hover:text-accent hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="mt-10 border-t border-line pt-5 text-[12px] leading-relaxed text-ink-3">
          Illustrations on this site are schematic. Obligraph is not affiliated with RBI, SEBI, IRDAI or any other regulator;
          always check obligations against the official text.
        </p>
      </div>
    </footer>
  );
}
