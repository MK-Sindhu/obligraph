import type { Metadata } from "next";
import { CtaBand, DocsLink, Eyebrow, JumpChips, PageIntro, ThemeShot, Ticks } from "@/components/marketing/blocks";
import type { ShotName } from "@/components/marketing/shots";

const DESCRIPTION = "Each Obligraph module at a glance: corpus, extraction, lineage, gaps, approvals, evidence, filings, readiness, board pack and Copilot.";

export const metadata: Metadata = {
  title: "Product",
  description: DESCRIPTION,
  alternates: { canonical: "/product" },
  openGraph: { title: "Obligraph product tour", description: DESCRIPTION, url: "/product" },
};

interface Module {
  id: string;
  name: string;
  title: string;
  points: string[];
  shot: ShotName;
  docs: string;
  maxHeight?: number;
}

const MODULES: Module[] = [
  {
    id: "corpus",
    name: "Regulatory corpus",
    title: "One library of circulars",
    points: ["Polled RBI and SEBI feeds", "PDF, Word, text or HTML by upload", "Filter by regulator, topic and status"],
    shot: "regulations",
    docs: "/docs/admin/regulator-feeds",
  },
  {
    id: "extraction",
    name: "Requirement extraction",
    title: "Circulars read into requirements",
    points: ["Kind, severity, frequency and due date", "The source sentence kept with each", "Offline extractor; Claude when configured"],
    shot: "requirements",
    docs: "/docs/concepts/obligations-and-coverage",
  },
  {
    id: "lineage",
    name: "Graph and lineage",
    title: "Know which version is current",
    points: ["Amends and supersedes, as a timeline", "What was in force on any date", "Explore by topic, or only what applies"],
    shot: "graph",
    docs: "/docs/concepts/knowledge-graph-and-lineage",
  },
  {
    id: "gaps",
    name: "Gap analysis",
    title: "Policies checked against every obligation",
    points: ["Covered, partial or missing", "The matching passage quoted and verified", "A suggested fix for each gap"],
    shot: "obligation",
    docs: "/docs/using/policies-and-gap-analysis",
    maxHeight: 560,
  },
  {
    id: "approvals",
    name: "Tasks and approvals",
    title: "A second pair of eyes",
    points: ["Suggested tasks with owners and dates", "Maker can't approve their own work", "Escalation when the SLA passes"],
    shot: "approval",
    docs: "/docs/using/tasks-and-approvals",
    maxHeight: 560,
  },
  {
    id: "evidence",
    name: "Evidence",
    title: "Proof that holds up",
    points: ["Files on tasks, obligations and filings", "SHA-256 checked on every download", "Audit pack with a hash manifest"],
    shot: "evidence",
    docs: "/docs/using/evidence-and-audit-pack",
  },
  {
    id: "calendar",
    name: "Calendar and filings",
    title: "Every date in one place",
    points: ["Deadlines, recurring duties, task dates", "Returns tracked period by period", "Acknowledgement kept with each filing"],
    shot: "calendar",
    docs: "/docs/using/calendar-and-filings",
  },
  {
    id: "readiness",
    name: "Readiness and SBR",
    title: "Ready, regime by regime",
    points: ["DPDP, CERT-In and KYC/AML packs", "Top gaps first", "What moving up an SBR layer adds"],
    shot: "readiness",
    docs: "/docs/using/readiness-packs",
  },
  {
    id: "board-pack",
    name: "Board pack",
    title: "A summary the board reads",
    points: ["Coverage by regulator and topic", "Gap ageing, filings and approvals", "Print or save as PDF; CSV exports"],
    shot: "board-pack",
    docs: "/docs/using/board-pack",
  },
  {
    id: "copilot",
    name: "Copilot",
    title: "Answers from your own records",
    points: ["Every answer lists its sources", "Retrieval summaries offline", "Written answers with Claude configured"],
    shot: "copilot",
    docs: "/docs/using/copilot",
  },
];

export default function ProductPage() {
  return (
    <>
      <PageIntro eyebrow="Product" title="Ten modules, one register" line="Analysis runs offline; Claude improves it when configured." />
      <JumpChips label="Modules" items={MODULES.map((m) => ({ id: m.id, name: m.name }))} />
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-8">
        {MODULES.map((m, i) => (
          <section key={m.id} id={m.id} aria-labelledby={`${m.id}-title`} className="grid scroll-mt-28 items-center gap-8 py-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
            <div className={i % 2 ? "lg:order-2" : undefined}>
              <Eyebrow>{m.name}</Eyebrow>
              <h2 id={`${m.id}-title`} className="display mt-2 text-[28px] font-extrabold leading-tight text-on-canvas sm:text-[34px]">
                {m.title}
              </h2>
              <Ticks items={m.points} className="mt-6" />
              <div className="mt-6">
                <DocsLink href={m.docs} />
              </div>
            </div>
            <ThemeShot name={m.shot} maxHeight={m.maxHeight} sizes="(min-width: 1024px) 680px, 100vw" />
          </section>
        ))}
      </div>
      <CtaBand title="See it on sample data" line="We'll walk through the modules that matter to you." />
    </>
  );
}
