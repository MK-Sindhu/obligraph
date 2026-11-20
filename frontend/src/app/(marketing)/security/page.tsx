import { Building2, Cpu, FileCheck2, History, KeyRound, ServerCog, Stamp, Users } from "lucide-react";
import type { Metadata } from "next";
import { CtaBand, FeatureTile, PageIntro } from "@/components/marketing/blocks";

const DESCRIPTION =
  "How Obligraph handles your data: tenant isolation, roles, maker-checker approvals, an activity log, SHA-256 evidence, single sign-on, self-hosting and AI that can run offline.";

export const metadata: Metadata = {
  title: "Security",
  description: DESCRIPTION,
  alternates: { canonical: "/security" },
  openGraph: { title: "Security at Obligraph", description: DESCRIPTION, url: "/security" },
};

const POINTS = [
  { icon: <Building2 size={22} />, title: "Tenant isolation", line: "Every query scoped to your organisation.", href: "/docs/security/security-and-data" },
  { icon: <Users size={22} />, title: "Roles", line: "Owner, admin, member and viewer.", href: "/docs/admin/roles" },
  { icon: <Stamp size={22} />, title: "Maker-checker", line: "No one approves their own work.", href: "/docs/using/tasks-and-approvals" },
  { icon: <History size={22} />, title: "Activity log", line: "Who changed what, and when.", href: "/docs/security/security-and-data" },
  { icon: <FileCheck2 size={22} />, title: "Hashed evidence", line: "SHA-256 on upload, checked on download.", href: "/docs/using/evidence-and-audit-pack" },
  { icon: <KeyRound size={22} />, title: "Single sign-on", line: "OpenID Connect, alongside password sign-in.", href: "/docs/admin/sso" },
  { icon: <ServerCog size={22} />, title: "Self-hostable", line: "Docker images; data stays where you deploy.", href: "/docs/deploy/docker" },
  { icon: <Cpu size={22} />, title: "AI can run offline", line: "With Claude on, documents go to Anthropic's API.", href: "/docs/security/security-and-data" },
];

export default function SecurityPage() {
  return (
    <>
      <PageIntro eyebrow="Security" title="How Obligraph handles your data" line="Controls as the product works today; details in the docs." />
      <section aria-label="Security controls" className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-8 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {POINTS.map((p) => (
            <FeatureTile key={p.title} icon={p.icon} title={p.title} line={p.line} href={p.href} />
          ))}
        </div>
      </section>
      <CtaBand title="Questions from your security team?" line="Send them with your demo request." />
    </>
  );
}
