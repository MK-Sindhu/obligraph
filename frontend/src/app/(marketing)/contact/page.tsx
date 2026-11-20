import { CalendarCheck2, MonitorPlay, ServerCog } from "lucide-react";
import type { Metadata } from "next";
import { PageIntro } from "@/components/marketing/blocks";
import { cardClass, iconTileClass } from "@/components/ui/styles";
import { ContactForm } from "./contact-form";

const DESCRIPTION = "Request a demo of Obligraph: a walkthrough on sample data, shaped to your entity types.";

export const metadata: Metadata = {
  title: "Request a demo",
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  openGraph: { title: "Request an Obligraph demo", description: DESCRIPTION, url: "/contact" },
};

const NEXT = [
  { icon: <CalendarCheck2 size={18} />, title: "We reply by email", line: "To find a time that suits you." },
  { icon: <MonitorPlay size={18} />, title: "A sample-data walkthrough", line: "The modules that matter to you." },
  { icon: <ServerCog size={18} />, title: "Deployment questions", line: "Including self-hosting with Docker." },
];

export default function ContactPage() {
  return (
    <>
      <PageIntro eyebrow="Contact" title="See it on your kind of entity" line="Tell us a little about you; we'll set up a walkthrough." />
      <div className="mx-auto grid w-full max-w-[1200px] items-start gap-6 px-4 pb-16 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ContactForm />
        <aside className={cardClass("raised", "lg", "px-6 py-7 sm:px-8")} aria-labelledby="what-next">
          <h2 id="what-next" className="label-caps text-[13px]">
            What happens next
          </h2>
          <ul className="mt-5 space-y-4">
            {NEXT.map((n) => (
              <li key={n.title} className="flex items-center gap-3.5">
                <span aria-hidden="true" className={iconTileClass("accent", "lg")}>
                  {n.icon}
                </span>
                <p className="text-[14px] leading-snug">
                  <span className="block font-bold text-ink">{n.title}</span>
                  <span className="text-ink-3">{n.line}</span>
                </p>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
