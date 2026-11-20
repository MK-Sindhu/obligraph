import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand, DoesList, PageIntro, ThemeShot } from "@/components/marketing/blocks";
import type { ShotName } from "@/components/marketing/shots";
import { glassClass } from "@/components/ui/glass";

const DESCRIPTION =
  "How Obligraph fits NBFCs, banks, payment aggregators and fintechs, and AIFs and SEBI intermediaries.";

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
  body: string;
  points: string[];
  shot: ShotName;
  caption: string;
  note?: string;
  maxHeight?: number;
}

const SEGMENTS: Segment[] = [
  {
    id: "nbfcs",
    name: "NBFCs",
    title: "For NBFCs: the layer you're in, the returns you owe",
    body: "Register as an NBFC, NBFC-MFI or housing finance company and Obligraph matches RBI requirements to you, including the ones that depend on your scale-based regulation layer.",
    points: [
      "Set your SBR layer and Obligraph adds the obligations for it and retires the ones that no longer apply; compare what moving up a layer would add.",
      "Track periodic returns period by period, with the acknowledgement for each filing. The returns catalogue ships as sample entries for you to verify against current directions.",
      "Fair Practices Code, penal charges and KYC requirements are checked against your policies, with the passage quoted and gaps turned into tasks.",
    ],
    shot: "sbr",
    caption: "Scale-based regulation layers for an NBFC.",
  },
  {
    id: "banks",
    name: "Banks",
    title: "For banks: oversight the board can read",
    body: "For commercial, small finance, payments and co-operative banks, the work is in showing that remediation was done and checked.",
    points: [
      "A board pack for any period: coverage by regulator and topic, gap ageing, critical gaps, missed filings and approvals, printable as a PDF.",
      "Maker-checker approvals with an SLA and escalation, so no remediation task is closed by the same person who did it.",
      "Evidence on every task and obligation, hashed with SHA-256, with an audit pack export.",
    ],
    shot: "board-pack",
    caption: "The board pack.",
  },
  {
    id: "fintechs",
    name: "Payment aggregators and fintechs",
    title: "For payment aggregators and fintechs: data protection and cyber readiness",
    body: "Payment aggregators, PPI issuers and digital lenders carry data protection and cyber reporting duties on top of their RBI requirements.",
    points: [
      "DPDP and CERT-In readiness packs show where you stand on each regime and the gaps to close first.",
      "Incident reporting windows, such as reporting a cyber incident within six hours, are extracted as requirements; the assessment flags a policy that allows a longer window.",
      "Digital lending requirements are tracked like any other obligation, with owners, tasks and evidence.",
    ],
    shot: "readiness",
    caption: "DPDP, CERT-In and KYC/AML readiness.",
  },
  {
    id: "sebi",
    name: "AIFs and SEBI intermediaries",
    title: "For AIFs and SEBI intermediaries",
    body: "AIFs, mutual funds, stock brokers, investment advisers, portfolio managers, depository participants and listed entities can register their SEBI entity types, and requirements that bind them become obligations.",
    points: [
      "Add SEBI circulars and master circulars by upload (PDF, Word, text or HTML) or as pasted text; each is read into requirements like any other instrument.",
      "Coverage against your policies, tasks, approvals, evidence and the board pack work the same as for RBI-regulated entities.",
    ],
    note: "Obligraph has a SEBI feed source, but SEBI's RSS feed currently publishes nothing, so SEBI documents arrive by upload for now.",
    shot: "requirements",
    caption: "Requirements extracted from an uploaded circular.",
  },
];

export default function SolutionsPage() {
  return (
    <>
      <PageIntro
        eyebrow="Solutions"
        title="One obligation register, shaped by what you're licensed as"
        intro="Obligraph decides which requirements apply to you from the entity types you register, so each segment sees its own obligations from the same corpus."
      />
      <nav aria-label="Segments" className="mx-auto w-full max-w-[1200px] px-4 sm:px-8">
        <ul className="flex flex-wrap gap-2">
          {SEGMENTS.map((s) => (
            <li key={s.id}>
              <Link href={`#${s.id}`} className="glass-subtle inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-medium text-ink-2 hover:text-ink hover:underline">
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-8">
        {SEGMENTS.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="grid scroll-mt-28 items-center gap-8 py-12 lg:grid-cols-2 lg:gap-14 lg:py-16">
            <div className={i % 2 ? "lg:order-2" : undefined}>
              <p className="text-[13px] font-medium text-accent">{s.name}</p>
              <h2 id={`${s.id}-title`} className="display mt-2 text-[26px] leading-tight text-ink sm:text-[32px]">
                {s.title}
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
              <DoesList items={s.points} />
              {s.note && (
                <p className={glassClass("subtle", "none", "mt-6 rounded-[20px] px-5 py-4 text-[13.5px] leading-relaxed text-ink-2")}>
                  <span className="font-medium text-ink">A note on SEBI feeds: </span>
                  {s.note}
                </p>
              )}
            </div>
            <ThemeShot name={s.shot} caption={s.caption} maxHeight={s.maxHeight} sizes="(min-width: 1024px) 560px, 100vw" />
          </section>
        ))}
      </div>
      <CtaBand title="Tell us what you're licensed as" body="We'll show the obligations Obligraph would create for your entity types, on sample data." />
    </>
  );
}
