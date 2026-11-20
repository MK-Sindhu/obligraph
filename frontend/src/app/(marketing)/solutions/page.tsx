import { Info } from "lucide-react";
import type { Metadata } from "next";
import { CtaBand, DocsLink, Eyebrow, JumpChips, PageIntro, ThemeShot, Ticks } from "@/components/marketing/blocks";
import type { ShotName } from "@/components/marketing/shots";

const DESCRIPTION = "How Obligraph fits NBFCs, banks, payment aggregators and fintechs, and AIFs and SEBI intermediaries.";

export const metadata: Metadata = {
  title: "Solutions",
  description: DESCRIPTION,
  alternates: { canonical: "/solutions" },
  openGraph: { title: "Obligraph for NBFCs, banks, fintechs and SEBI intermediaries", description: DESCRIPTION, url: "/solutions" },
};

interface Segment {
  id: string;
  name: string;
  title: string;
  points: string[];
  shot: ShotName;
  docs: string;
  note?: string;
  maxHeight?: number;
}

const SEGMENTS: Segment[] = [
  {
    id: "nbfcs",
    name: "NBFCs",
    title: "Your layer, your returns",
    points: ["SBR layer adds and retires obligations", "Returns tracked with acknowledgements", "Fair Practices and KYC checked against policies"],
    shot: "sbr",
    docs: "/docs/concepts/sbr-layers",
  },
  {
    id: "banks",
    name: "Banks",
    title: "Oversight the board can read",
    points: ["Board pack for any period", "Maker-checker with SLA escalation", "Hashed evidence and an audit pack"],
    shot: "board-pack",
    docs: "/docs/using/board-pack",
  },
  {
    id: "fintechs",
    name: "Payment aggregators and fintechs",
    title: "Data protection and cyber readiness",
    points: ["DPDP and CERT-In readiness packs", "Incident reporting windows tracked", "Digital lending duties with owners"],
    shot: "readiness",
    docs: "/docs/using/readiness-packs",
  },
  {
    id: "sebi",
    name: "AIFs and SEBI intermediaries",
    title: "SEBI circulars, mapped to you",
    points: ["Add circulars by upload or pasted text", "Same coverage, tasks and board pack"],
    note: "SEBI's RSS feed currently publishes nothing, so SEBI documents arrive by upload.",
    shot: "requirements",
    docs: "/docs/admin/regulator-feeds",
  },
];

export default function SolutionsPage() {
  return (
    <>
      <PageIntro eyebrow="Solutions" title="Shaped by what you're licensed as" line="Your entity types decide which requirements become your obligations." />
      <JumpChips label="Segments" items={SEGMENTS.map((s) => ({ id: s.id, name: s.name }))} />
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-8">
        {SEGMENTS.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="grid scroll-mt-28 items-center gap-8 py-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
            <div className={i % 2 ? "lg:order-2" : undefined}>
              <Eyebrow>{s.name}</Eyebrow>
              <h2 id={`${s.id}-title`} className="display mt-2 text-[28px] font-extrabold leading-tight text-on-canvas sm:text-[34px]">
                {s.title}
              </h2>
              <Ticks items={s.points} className="mt-6" />
              {s.note && (
                <p className="mt-5 flex items-start gap-2.5 rounded-[14px] bg-surface px-4 py-3 text-[13.5px] font-medium text-ink-2 shadow-xs">
                  <Info size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                  {s.note}
                </p>
              )}
              <div className="mt-6">
                <DocsLink href={s.docs} />
              </div>
            </div>
            <ThemeShot name={s.shot} maxHeight={s.maxHeight} sizes="(min-width: 1024px) 680px, 100vw" />
          </section>
        ))}
      </div>
      <CtaBand title="Tell us what you're licensed as" line="We'll show the obligations it creates, on sample data." />
    </>
  );
}
