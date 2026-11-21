import {
  CalendarDays,
  FileCheck2,
  FileSearch,
  Gauge,
  Layers,
  ListChecks,
  MessageSquareText,
  PieChart,
  Radar,
  ScrollText,
  ShieldCheck,
  Stamp,
  Waypoints,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand, CtaLinks, Eyebrow, FeatureTile, Section } from "@/components/marketing/blocks";
import { Plate } from "@/components/marketing/plate";
import { iconTileClass } from "@/components/ui/styles";

const DESCRIPTION = "Obligraph reads RBI, SEBI and IRDAI circulars, checks your policies and turns gaps into dated work.";

export const metadata: Metadata = {
  title: { absolute: "Obligraph · Every circular, traced to its obligations" },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: "Obligraph · Every circular, traced to its obligations", description: DESCRIPTION, url: "/" },
};

const STEPS = [
  { icon: <Radar size={22} />, title: "Monitor", line: "Polled regulator feeds, plus anything you upload." },
  { icon: <FileSearch size={22} />, title: "Extract", line: "Each circular split into dated, quoted requirements." },
  { icon: <Gauge size={22} />, title: "Map and assess", line: "Matched to you, checked against your policies." },
  { icon: <ListChecks size={22} />, title: "Act and prove", line: "Tasks, approvals, evidence and filings, all recorded." },
];

const FEATURES = [
  { icon: <Waypoints size={22} />, title: "Graph and lineage", line: "Follow amendments and supersessions; see what was in force.", href: "/docs/concepts/knowledge-graph-and-lineage" },
  { icon: <ScrollText size={22} />, title: "Obligation extraction", line: "Circulars become requirements with severity and due dates.", href: "/docs/concepts/obligations-and-coverage" },
  { icon: <FileSearch size={22} />, title: "Gap analysis", line: "Covered, partial or missing, with the policy passage quoted.", href: "/docs/using/policies-and-gap-analysis" },
  { icon: <CalendarDays size={22} />, title: "Calendar and filings", line: "Deadlines, recurring duties and returns, with acknowledgements.", href: "/docs/using/calendar-and-filings" },
  { icon: <Stamp size={22} />, title: "Maker-checker", line: "A second sign-off, escalated when the SLA passes.", href: "/docs/using/tasks-and-approvals" },
  { icon: <FileCheck2 size={22} />, title: "Evidence and audit pack", line: "SHA-256 fingerprinted files, exported with a hash manifest.", href: "/docs/using/evidence-and-audit-pack" },
  { icon: <ShieldCheck size={22} />, title: "Readiness packs", line: "DPDP, CERT-In and KYC/AML readiness at a glance.", href: "/docs/using/readiness-packs" },
  { icon: <Layers size={22} />, title: "NBFC SBR layers", line: "What changes between the Base, Middle, Upper and Top layers.", href: "/docs/concepts/sbr-layers" },
  { icon: <PieChart size={22} />, title: "Board pack", line: "A period summary for the board, printable as PDF.", href: "/docs/using/board-pack" },
  { icon: <MessageSquareText size={22} />, title: "Copilot", line: "Answers from your records, with sources. Works offline.", href: "/docs/using/copilot" },
];

const SEGMENTS = [
  { label: "NBFCs", href: "/solutions#nbfcs" },
  { label: "Banks", href: "/solutions#banks" },
  { label: "Payment aggregators and fintechs", href: "/solutions#fintechs" },
  { label: "AIFs and SEBI intermediaries", href: "/solutions#sebi" },
];

export default function HomePage() {
  return (
    <>
      <section aria-labelledby="hero-title" className="mx-auto grid w-full max-w-[1200px] items-center gap-10 px-4 pb-8 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div>
          <Eyebrow>Regulatory obligations · India</Eyebrow>
          <h1 id="hero-title" className="display mt-3 text-[42px] font-extrabold leading-[1.02] text-on-canvas sm:text-[60px]">
            Every circular, traced to its obligations.
          </h1>
          <p className="mt-5 max-w-[520px] text-[17px] text-on-canvas-2">{DESCRIPTION}</p>
          <CtaLinks className="mt-8" />
        </div>

        <Plate art="pipeline" tone="signal" index="RBI · SEBI · IRDAI" tag="Circular → calendar" title="Obligraph" />
      </section>

      <Section id="how-it-works" eyebrow="How it works" title="From circular to closed work" center>
        <ol className="relative grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
          <span aria-hidden="true" className="absolute left-[12%] right-[12%] top-[34px] hidden h-[2px] bg-white/70 lg:block" />
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative flex flex-col items-center text-center">
              <span aria-hidden="true" className={iconTileClass(i === 0 ? "selected" : "soft", "xl", "h-[68px]! w-[68px]! rounded-[20px]! shadow-card [&_svg]:size-7")}>
                {s.icon}
              </span>
              <span className="mt-4 text-[16px] font-extrabold text-on-canvas">
                <span className="sr-only">Step {i + 1}: </span>
                {s.title}
              </span>
              <span className="mt-1 max-w-[220px] text-[13px] text-on-canvas-2 sm:text-[13.5px]">{s.line}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="features" eyebrow="What's in it" title="Everything between circular and board">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {FEATURES.map((f) => (
            <FeatureTile key={f.title} icon={f.icon} title={f.title} line={f.line} href={f.href} />
          ))}
        </div>
        <p className="mt-6">
          <Link href="/product" className="text-[14px] font-bold text-accent-deep hover:underline">
            See each module →
          </Link>
        </p>
      </Section>

      <Section id="built-for" eyebrow="Built for" title="Licensed by RBI, SEBI or IRDAI" center>
        <ul className="flex flex-wrap justify-center gap-3">
          {SEGMENTS.map((s) => (
            <li key={s.label}>
              <Link
                href={s.href}
                className="inline-flex h-11 items-center rounded-full border border-white/70 bg-surface px-5 text-[14px] font-bold text-ink shadow-xs transition-colors hover:border-primary hover:text-accent"
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand title="See it on your entity type" line="A walkthrough on sample data, shaped to your licence." />
    </>
  );
}
