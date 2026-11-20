import { FileCheck2, ListChecks, TriangleAlert } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { IconTile } from "@/components/ui/button";
import { Timeline } from "@/components/ui/timeline";

/** Sample lineage shown beside the sign-in form: the product's core idea in one glance. */
function LineagePreview() {
  return (
    <Timeline
      ariaLabel="Illustrative sample lineage: a 2019 circular superseded by a 2026 circular"
      minItemWidth={170}
      items={[
        {
          id: "2019",
          pill: "12 Aug 2019",
          title: "Fair Practices Code for NBFCs",
          meta: "Superseded",
          extra: <span className="mt-1 font-mono text-[10.5px] text-ink-3">OG/SAMPLE/RBI/2019-20/07</span>,
        },
        {
          id: "2026",
          pill: "20 Mar 2026",
          title: "Revised Fair Practices Code and Penal Charges",
          meta: "In force",
          extra: <span className="mt-1 font-mono text-[10.5px] text-ink-3">OG/SAMPLE/RBI/2025-26/74</span>,
          active: true,
          connector: "Superseded by",
          connectorTone: "warn",
        },
        {
          id: "next",
          pill: "Your policies",
          title: "6 obligations created",
          meta: "3 missing a policy clause",
          muted: true,
          connector: "Creates",
        },
      ]}
    />
  );
}

const POINTS = [
  { icon: <ListChecks size={18} />, title: "Obligations, not PDFs", body: "Each requirement becomes an obligation with an owner." },
  { icon: <FileCheck2 size={18} />, title: "Policy coverage", body: "Your policies are checked and quoted as evidence." },
  { icon: <TriangleAlert size={18} />, title: "Gaps first", body: "Missing and partial coverage, ranked by severity." },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-12 sm:py-8">
        <Wordmark />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
        <p className="text-[12px] text-ink-3">Obligation tracking for RBI, SEBI and IRDAI regulated entities.</p>
      </div>
      <div className="relative hidden py-8 pr-8 lg:flex">
        <div className="flex w-full flex-col justify-center rounded-card-lg soft px-10 py-12 xl:px-14">
          <div className="max-w-[620px]">
            <p className="mb-3 text-[12.5px] font-medium text-accent">How Obligraph reads a circular</p>
            <h2 className="display text-[34px] leading-[1.18] text-ink">
              Every circular, traced to the obligation it creates and the policy clause that meets it.
            </h2>
            <div className="mt-10 rounded-[28px] soft-inset px-4 pb-4 pt-2">
              <LineagePreview />
              <p className="mt-1 text-center text-[11px] text-ink-3">Illustrative sample, not a real circular.</p>
            </div>
            <ul className="mt-10 grid gap-4 xl:grid-cols-3">
              {POINTS.map((p) => (
                <li key={p.title} className="flex gap-3 xl:flex-col">
                  <IconTile tone="accent" size="md">
                    {p.icon}
                  </IconTile>
                  <div>
                    <p className="text-[13.5px] font-medium text-ink">{p.title}</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
