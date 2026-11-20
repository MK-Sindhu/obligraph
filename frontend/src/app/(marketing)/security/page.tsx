import { Building2, Cpu, FileCheck2, History, KeyRound, ServerCog, Stamp, Users } from "lucide-react";
import type { Metadata } from "next";
import { CtaBand, FeatureCard, PageIntro } from "@/components/marketing/blocks";

const DESCRIPTION =
  "How Obligraph handles your data: tenant isolation, roles, maker-checker approvals, an activity log, SHA-256 evidence, single sign-on, self-hosting and what the AI sends where.";

export const metadata: Metadata = {
  title: "Security",
  description: DESCRIPTION,
  alternates: { canonical: "/security" },
  openGraph: { title: "Security at Obligraph", description: DESCRIPTION, url: "/security" },
};

const POINTS = [
  {
    icon: <Building2 size={18} />,
    title: "Tenant isolation on every query",
    body: "Each organisation's obligations, policies, tasks, approvals, evidence and activity are scoped to it in every query. One organisation never sees another's records; only the regulatory corpus is shared.",
  },
  {
    icon: <Users size={18} />,
    title: "Roles",
    body: "Owner, admin, member and viewer. Viewers read; members work tasks and obligations; admins also upload policies, manage members and change settings; owners have full control.",
  },
  {
    icon: <Stamp size={18} />,
    title: "Maker-checker approvals",
    body: "Tasks can require a second person's sign-off. The maker can't approve their own work, a rejection needs a reason, and requests past the SLA escalate.",
  },
  {
    icon: <History size={18} />,
    title: "Activity log",
    body: "Assessments, status and owner changes, uploads, approvals and membership changes are recorded with who did them and when.",
  },
  {
    icon: <FileCheck2 size={18} />,
    title: "Hashed evidence and an audit pack",
    body: "Every evidence file is fingerprinted with SHA-256 on upload and checked when it is downloaded. The audit pack export includes the files and a hash manifest.",
  },
  {
    icon: <KeyRound size={18} />,
    title: "OpenID Connect single sign-on",
    body: "When configured, people sign in through your identity provider with OpenID Connect, alongside password sign-in.",
  },
  {
    icon: <ServerCog size={18} />,
    title: "Self-hostable with Docker",
    body: "Obligraph runs as Docker containers, so you can deploy it in your own environment and keep the data where you put it.",
  },
  {
    icon: <Cpu size={18} />,
    title: "AI that can run offline",
    body: "Extraction, assessment and Copilot work fully offline with built-in heuristics. If you enable Claude, the documents and questions being processed are sent to Anthropic's API.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <PageIntro
        eyebrow="Security"
        title="How Obligraph handles your data"
        intro="The controls below are how the product works today. Where something depends on how you deploy or configure it, we say so."
      />
      <section aria-label="Security controls" className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-6 sm:px-8">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {POINTS.map((p) => (
            <FeatureCard key={p.title} icon={p.icon} title={p.title}>
              {p.body}
            </FeatureCard>
          ))}
        </div>
      </section>
      <CtaBand title="Questions from your security team?" body="Send them with your demo request and we'll go through them with you." />
    </>
  );
}
