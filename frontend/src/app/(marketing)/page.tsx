import {
  ArrowRight,
  Building2,
  CalendarDays,
  FileCheck2,
  FileSearch,
  Fingerprint,
  Gauge,
  KeyRound,
  Landmark,
  Layers,
  ListChecks,
  MessageSquareText,
  PieChart,
  Radar,
  ScrollText,
  ServerCog,
  ShieldCheck,
  Stamp,
  Users,
  Wallet,
  Waypoints,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand, CtaLinks, Eyebrow, FeatureCard, Section, ThemeShot } from "@/components/marketing/blocks";
import { glassClass } from "@/components/ui/glass";
import { iconTileClass } from "@/components/ui/styles";

const DESCRIPTION =
  "Obligraph turns circulars from RBI, SEBI, IRDAI and other regulators into the obligations that apply to you, the gaps in your policies and dated, owned work.";

export const metadata: Metadata = {
  title: { absolute: "Obligraph · Regulatory obligations for Indian financial institutions" },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Obligraph · Every circular, traced to the obligation it creates",
    description: DESCRIPTION,
    url: "/",
  },
};

const STEPS = [
  {
    icon: <Radar size={18} />,
    title: "Monitor",
    body: "Regulator feeds are polled on a schedule, and anything else (a PDF, a Word file or pasted text) can be added by upload. Each document joins one shared corpus.",
  },
  {
    icon: <FileSearch size={18} />,
    title: "Extract",
    body: "Each instrument is read into individual requirements with their severity, frequency, due date and the entity types they bind, quoting the source text. Amendments and supersessions are linked into a lineage.",
  },
  {
    icon: <Gauge size={18} />,
    title: "Map and assess",
    body: "Requirements that bind your entity types become your obligations. Each is checked against your uploaded policies and marked covered, partial or missing, with the matching passage quoted.",
  },
  {
    icon: <ListChecks size={18} />,
    title: "Act and prove",
    body: "Gaps turn into suggested tasks with owners and due dates. Maker-checker approvals, hashed evidence, filings and a board pack show the work was done.",
  },
];

const FEATURES = [
  {
    icon: <Waypoints size={18} />,
    title: "Knowledge graph and lineage",
    body: "Regulations, regulators, entity types, topics and acts in one graph. Follow amends and supersedes links, and check what was in force on any date.",
  },
  {
    icon: <ScrollText size={18} />,
    title: "Obligation extraction",
    body: "Circulars become numbered requirements with severity, frequency, due dates and the entity types they bind, each with its source text.",
  },
  {
    icon: <FileSearch size={18} />,
    title: "Gap analysis with verbatim evidence",
    body: "Every obligation is assessed against your policies: covered, partial or missing, with the exact passage quoted and a suggested fix.",
  },
  {
    icon: <CalendarDays size={18} />,
    title: "Compliance calendar and filings",
    body: "Deadlines, recurring obligations, task due dates and statutory returns on one calendar. Record each filing with its acknowledgement.",
  },
  {
    icon: <Stamp size={18} />,
    title: "Maker-checker approvals with escalation",
    body: "Remediation can need a second person's sign-off. Requests not decided within your SLA escalate to the next level of approver.",
  },
  {
    icon: <FileCheck2 size={18} />,
    title: "Evidence and audit pack",
    body: "Attach files to tasks, obligations and filings. Each is fingerprinted with SHA-256; export everything, with a hash manifest, as one audit pack.",
  },
  {
    icon: <ShieldCheck size={18} />,
    title: "DPDP, CERT-In and KYC readiness packs",
    body: "See how ready you are for each regime as one figure, with the gaps that matter most and a drill-down to every obligation.",
  },
  {
    icon: <Layers size={18} />,
    title: "NBFC SBR layer view",
    body: "Which requirements differ between the Base, Middle, Upper and Top layers, and what moving up a layer would add.",
  },
  {
    icon: <PieChart size={18} />,
    title: "Board pack",
    body: "A compliance summary for any period: coverage by regulator and topic, gap ageing, missed filings and approvals. Print it or save it as a PDF.",
  },
  {
    icon: <MessageSquareText size={18} />,
    title: "Copilot with citations",
    body: "Ask about your regulations, obligations and deadlines; every answer lists its sources. Offline it returns retrieval summaries; with Claude configured it writes the answer.",
  },
];

const SEGMENTS = [
  { icon: <Building2 size={18} />, title: "NBFCs", body: "SBR layers, periodic returns, the Fair Practices Code and KYC.", href: "/solutions#nbfcs" },
  { icon: <Landmark size={18} />, title: "Banks", body: "A board pack, maker-checker approvals and an evidence trail.", href: "/solutions#banks" },
  { icon: <Wallet size={18} />, title: "Payment aggregators and fintechs", body: "DPDP and CERT-In readiness and incident reporting windows.", href: "/solutions#fintechs" },
  { icon: <Users size={18} />, title: "AIFs and SEBI intermediaries", body: "SEBI circulars added by upload, mapped to your registration.", href: "/solutions#sebi" },
];

const SECURITY = [
  { icon: <ServerCog size={16} />, label: "Self-hostable with Docker" },
  { icon: <Building2 size={16} />, label: "Tenant isolation on every query" },
  { icon: <Users size={16} />, label: "Owner, admin, member and viewer roles" },
  { icon: <Fingerprint size={16} />, label: "SHA-256 evidence, checked on download" },
  { icon: <KeyRound size={16} />, label: "OpenID Connect single sign-on" },
];

export default function HomePage() {
  return (
    <>
      <section aria-labelledby="hero-title" className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-14 sm:px-8 sm:pt-20">
        <div className="mx-auto max-w-[920px] text-center">
          <Eyebrow>Regulatory obligations for Indian financial institutions</Eyebrow>
          <h1 id="hero-title" className="display mt-6 text-[36px] leading-[1.08] text-ink sm:text-[56px]">
            Every circular, traced to the obligation it creates and the policy clause that meets it.
          </h1>
          <p className="mx-auto mt-6 max-w-[720px] text-[16.5px] leading-relaxed text-ink-2 sm:text-[18px]">
            Obligraph monitors RBI, SEBI, IRDAI and other regulators through their feeds and the documents you upload, and turns
            each circular into the obligations that apply to you, the gaps in your policies and dated work with an owner.
          </p>
          <CtaLinks className="mt-9 justify-center" />
        </div>

        <div className="relative mx-auto mt-14 max-w-[1120px]">
          <ThemeShot name="dashboard" priority sizes="(min-width: 1200px) 1120px, 100vw" caption="The dashboard: policy coverage, workload, filings and approvals." />
          <div className="pointer-events-none absolute -bottom-10 -right-6 hidden w-[330px] xl:block">
            <ThemeShot name="approval" maxHeight={300} sizes="330px" caption="An approval with its history." className="pointer-events-auto shadow-pop" />
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-[1120px] space-y-6 xl:mt-20">
          <ThemeShot name="lineage" sizes="(min-width: 1200px) 1120px, 100vw" caption="Lineage: a circular superseded by its revision." />
          <ThemeShot name="readiness" maxHeight={470} sizes="(min-width: 1200px) 1120px, 100vw" caption="Readiness gauges for DPDP, CERT-In and KYC/AML." />
        </div>
      </section>

      <Section id="how-it-works" eyebrow="How it works" title="From a circular to closed, provable work" center>
        <ol className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className={glassClass("default", "tile", "relative px-6 pb-6 pt-5")}>
              <div className="flex items-center justify-between">
                <span aria-hidden="true" className={iconTileClass("accent", "md")}>
                  {s.icon}
                </span>
                <span className="figure text-[34px] leading-none text-ink-3/50" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="display mt-4 text-[17px] text-ink">
                <span className="sr-only">Step {i + 1}: </span>
                {s.title}
              </h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id="features"
        eyebrow="What's in it"
        title="Everything between the circular and the board"
        intro="Each of these works today on your own data. Analysis runs offline out of the box, and is better with Claude configured."
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} icon={f.icon} title={f.title}>
              {f.body}
            </FeatureCard>
          ))}
        </div>
        <p className="mt-8 text-center">
          <Link href="/product" className="inline-flex items-center gap-1.5 rounded-full text-[14px] font-medium text-accent hover:underline">
            How each module works <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </p>
      </Section>

      <Section id="built-for" eyebrow="Built for" title="Regulated entities across Indian financial services">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {SEGMENTS.map((s) => (
            <Link key={s.title} href={s.href} className={glassClass("default", "tile", "group flex flex-col px-6 pb-6 pt-5 transition-transform hover:-translate-y-0.5")}>
              <span aria-hidden="true" className={iconTileClass("soft", "md")}>
                {s.icon}
              </span>
              <span className="display mt-4 text-[16.5px] text-ink group-hover:text-accent">{s.title}</span>
              <span className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{s.body}</span>
              <span className="mt-auto inline-flex items-center gap-1 pt-4 text-[13px] font-medium text-accent">
                Read more <ArrowRight size={14} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <section aria-labelledby="security-strip-title" className="mx-auto w-full max-w-[1200px] px-4 pb-16 sm:px-8">
        <div className={glassClass("default", "lg", "flex flex-col gap-6 px-6 py-7 sm:px-10 lg:flex-row lg:items-center")}>
          <div className="lg:w-[260px] lg:shrink-0">
            <h2 id="security-strip-title" className="display text-[20px] text-ink">
              Security you can check
            </h2>
            <Link href="/security" className="mt-1.5 inline-flex items-center gap-1 rounded-full text-[13.5px] font-medium text-accent hover:underline">
              How Obligraph handles your data <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <ul className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {SECURITY.map((s) => (
              <li key={s.label} className="flex items-center gap-3 text-[13.5px] text-ink">
                <span aria-hidden="true" className={iconTileClass("soft", "sm")}>
                  {s.icon}
                </span>
                {s.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand
        title="See your obligations, not just the circulars"
        body="We'll walk you through Obligraph on sample data and show how it would map to your entity types and policies."
      />
    </>
  );
}
