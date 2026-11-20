import { CalendarCheck2, MonitorPlay, ServerCog } from "lucide-react";
import type { Metadata } from "next";
import { PageIntro } from "@/components/marketing/blocks";
import { glassClass } from "@/components/ui/glass";
import { iconTileClass } from "@/components/ui/styles";
import { ContactForm } from "./contact-form";

const DESCRIPTION = "Request a demo of Obligraph: a walkthrough on sample data, shaped to your entity types.";

export const metadata: Metadata = {
  title: "Request a demo",
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  openGraph: { title: "Request an Obligraph demo", description: DESCRIPTION, url: "/contact" },
};

const NEXT = [
  { icon: <CalendarCheck2 size={17} />, title: "We reply by email", body: "to find a time that suits you and your team." },
  { icon: <MonitorPlay size={17} />, title: "A walkthrough on sample data", body: "covering the modules that matter for your entity types." },
  { icon: <ServerCog size={17} />, title: "Deployment questions", body: "including running Obligraph in your own environment with Docker." },
];

export default function ContactPage() {
  return (
    <>
      <PageIntro
        eyebrow="Contact"
        title="See Obligraph on your kind of entity"
        intro="Ask for a demo and we'll show how circulars become obligations, gaps and dated work for an organisation like yours."
      />
      <div className="mx-auto grid w-full max-w-[1200px] items-start gap-8 px-4 pb-20 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ContactForm />
        <aside className={glassClass("default", "lg", "px-6 py-8 sm:px-8")} aria-labelledby="what-next">
          <h2 id="what-next" className="display text-[19px] text-ink">
            What happens next
          </h2>
          <ul className="mt-5 space-y-5">
            {NEXT.map((n) => (
              <li key={n.title} className="flex gap-3.5">
                <span aria-hidden="true" className={iconTileClass("accent", "sm")}>
                  {n.icon}
                </span>
                <p className="text-[14px] leading-relaxed text-ink-2">
                  <span className="font-medium text-ink">{n.title}</span> {n.body}
                </p>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
