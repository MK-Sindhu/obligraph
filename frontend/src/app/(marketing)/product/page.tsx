import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand, DoesList, PageIntro, ThemeShot } from "@/components/marketing/blocks";
import type { ShotName } from "@/components/marketing/shots";

const DESCRIPTION =
  "What each Obligraph module does today: the regulatory corpus, requirement extraction, lineage, gap analysis, tasks and approvals, evidence, filings, readiness, the board pack and Copilot.";

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
  body: string;
  does: string[];
  shot: ShotName;
  caption: string;
  maxHeight?: number;
}

const MODULES: Module[] = [
  {
    id: "corpus",
    name: "Regulatory corpus",
    title: "One corpus of circulars, directions and notifications",
    body: "Obligraph keeps a shared library of the instruments it has read, with each one's regulator, reference number, dates, status and topics.",
    does: [
      "Polls the RBI notifications, RBI press releases and SEBI feeds on a schedule once a platform admin turns them on.",
      "Takes any other document by upload (PDF, Word, text, Markdown or HTML) or as pasted text, so IRDAI, MeitY or CERT-In material can be added too.",
      "Filters by regulator, topic and status, and by whether an instrument applies to your organisation.",
    ],
    shot: "regulations",
    caption: "The regulations list.",
  },
  {
    id: "extraction",
    name: "Requirement extraction",
    title: "Each instrument read into requirements",
    body: "A circular is broken into the individual things it requires, so each one can be owned, assessed and tracked.",
    does: [
      "Records each requirement's kind, severity, frequency, due date and the entity types it binds.",
      "Keeps the source text, so you can see exactly where a requirement comes from.",
      "Runs with an offline extractor out of the box; with Claude configured, extraction uses Claude.",
    ],
    shot: "requirements",
    caption: "Requirements extracted from a circular, with your coverage of each.",
  },
  {
    id: "lineage",
    name: "Knowledge graph and lineage",
    title: "Which version of a rule is current",
    body: "Regulations, regulators, entity types, topics and acts are nodes in one graph; amendments and supersessions are its edges.",
    does: [
      "Shows each instrument's family as a timeline: what it amends or supersedes, and what later amended or superseded it.",
      "Answers what was in force on a given date.",
      "Lets you explore the graph by topic, or only what applies to you.",
    ],
    shot: "graph",
    caption: "The knowledge graph.",
  },
  {
    id: "gaps",
    name: "Gap analysis",
    title: "Your policies, checked against every obligation",
    body: "Requirements that bind your entity types become obligations, and each one is assessed against the policies you upload.",
    does: [
      "Marks each obligation covered, partial or missing, with a confidence figure.",
      "Quotes the policy passage it relied on, so a reviewer can check the reasoning.",
      "Suggests what to change, and re-assesses when you upload or delete a policy.",
    ],
    shot: "obligation",
    caption: "An obligation with its assessment and the quoted policy passage.",
    maxHeight: 620,
  },
  {
    id: "approvals",
    name: "Tasks and approvals",
    title: "Remediation with a second pair of eyes",
    body: "Gaps become tasks on a board, and the tasks that matter can require a checker before they count as done.",
    does: [
      "Suggests remediation tasks for gaps; your team edits, assigns and dates them.",
      "Runs maker-checker approvals: the maker submits with a note and evidence, and a checker approves or rejects with a reason.",
      "Escalates requests not decided within your SLA to the next level of approver, and keeps every step in the history.",
    ],
    shot: "approval",
    caption: "An approved request with its notes, evidence and history.",
    maxHeight: 640,
  },
  {
    id: "evidence",
    name: "Evidence and audit pack",
    title: "Proof that holds up",
    body: "Files are attached where the work happened, on a task, an obligation or a filing.",
    does: [
      "Fingerprints every file with SHA-256 on upload and checks the hash when it is downloaded.",
      "Lists all evidence in one register with who uploaded it and what it backs.",
      "Exports CSVs and an audit pack (.zip) with the evidence files and a hash manifest.",
    ],
    shot: "evidence",
    caption: "The evidence register.",
  },
  {
    id: "calendar",
    name: "Calendar and filings",
    title: "Every date in one place",
    body: "Deadlines from requirements, recurring obligations, task due dates and statutory returns share one calendar.",
    does: [
      "Tracks returns period by period as pending, overdue, filed, filed late or waived.",
      "Records the filing date, the acknowledgement reference and the acknowledgement file.",
      "Ships with a sample returns catalogue to verify against current directions, and lets admins add their own returns.",
    ],
    shot: "calendar",
    caption: "The compliance calendar.",
  },
  {
    id: "readiness",
    name: "Readiness and SBR",
    title: "How ready you are, regime by regime",
    body: "Readiness packs group the obligations from one regime so you can see where you stand.",
    does: [
      "DPDP, CERT-In and KYC/AML packs, each with a readiness figure, its top gaps and every obligation behind it.",
      "For NBFCs, the requirements that differ between the Base, Middle, Upper and Top layers.",
      "What moving to another layer would add, and what it would relieve.",
    ],
    shot: "sbr",
    caption: "Scale-based regulation layers for an NBFC.",
  },
  {
    id: "board-pack",
    name: "Board pack and exports",
    title: "A summary the board can read",
    body: "Pick a period and Obligraph assembles the compliance summary from your data.",
    does: [
      "Headline coverage, open gaps by severity, overdue tasks, approvals and filings.",
      "Coverage by regulator and topic, gap ageing, critical gaps, new and superseded instruments, and ownership.",
      "A printable version to save as PDF, and CSV exports of obligations, tasks, approvals, evidence, filings, activity and policies.",
    ],
    shot: "board-pack",
    caption: "The board pack for a period.",
  },
  {
    id: "copilot",
    name: "Copilot",
    title: "Questions answered from your own records",
    body: "Copilot searches the corpus, traces lineage and reads your obligations, tasks, deadlines and policies to answer a question.",
    does: [
      "Lists the regulations and policy passages each answer drew on.",
      "Without Claude configured, it returns retrieval summaries: the most relevant regulations, obligations and passages.",
      "With Claude configured, it writes the answer.",
    ],
    shot: "copilot",
    caption: "Copilot answering a question, with its sources.",
  },
];

export default function ProductPage() {
  return (
    <>
      <PageIntro
        eyebrow="Product"
        title="What Obligraph does, module by module"
        intro="Every module below works today. Analysis runs offline out of the box; with Claude configured, extraction, assessment and Copilot answers use Claude."
      />
      <nav aria-label="Modules" className="mx-auto w-full max-w-[1200px] px-4 sm:px-8">
        <ul className="flex flex-wrap gap-2">
          {MODULES.map((m) => (
            <li key={m.id}>
              <Link
                href={`#${m.id}`}
                className="glass-subtle inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-medium text-ink-2 hover:text-ink hover:underline"
              >
                {m.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-8">
        {MODULES.map((m, i) => (
          <section
            key={m.id}
            id={m.id}
            aria-labelledby={`${m.id}-title`}
            className="grid scroll-mt-28 items-center gap-8 py-12 lg:grid-cols-2 lg:gap-14 lg:py-16"
          >
            <div className={i % 2 ? "lg:order-2" : undefined}>
              <p className="text-[13px] font-medium text-accent">{m.name}</p>
              <h2 id={`${m.id}-title`} className="display mt-2 text-[26px] leading-tight text-ink sm:text-[32px]">
                {m.title}
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{m.body}</p>
              <DoesList items={m.does} />
            </div>
            <ThemeShot name={m.shot} caption={m.caption} maxHeight={m.maxHeight} sizes="(min-width: 1024px) 560px, 100vw" />
          </section>
        ))}
      </div>
      <CtaBand title="See it on sample data" body="We'll walk through each module and show how it would apply to your entity types and policies." />
    </>
  );
}
