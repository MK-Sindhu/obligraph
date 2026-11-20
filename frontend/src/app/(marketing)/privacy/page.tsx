import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/marketing/blocks";

// Placeholder: replace with the owner's real privacy contact before publishing.
const PRIVACY_EMAIL = "privacy@obligraph.example";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "What the Obligraph demo request form collects, why, how long it is kept and how to ask for deletion.",
  alternates: { canonical: "/privacy" },
  openGraph: { title: "Obligraph privacy notice", url: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <PageIntro
        eyebrow="Privacy"
        title="Privacy notice"
        line="What the demo request form collects, and how to have it deleted."
      />
      <article className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-4 sm:px-8">
        <div className="card max-w-[820px] rounded-card-lg px-6 py-8 text-[15px] leading-relaxed text-ink-2 sm:px-10 sm:py-10">
          <h2 className="display text-[20px] text-ink">What we collect</h2>
          <p className="mt-2">
            When you request a demo we collect your name, work email and company, and, if you give them, your role, the type of
            entity you are and your message.
          </p>

          <h2 className="display mt-8 text-[20px] text-ink">Why</h2>
          <p className="mt-2">To reply to your request and arrange the demo. We don&rsquo;t add you to a mailing list.</p>

          <h2 className="display mt-8 text-[20px] text-ink">How long we keep it</h2>
          <p className="mt-2">Until your request has been handled; after that, until you ask us to delete it.</p>

          <h2 className="display mt-8 text-[20px] text-ink">Asking for deletion</h2>
          <p className="mt-2">
            Email{" "}
            <a href={`mailto:${PRIVACY_EMAIL}`} className="font-medium text-accent underline underline-offset-2">
              {PRIVACY_EMAIL}
            </a>{" "}
            from the address you used on the form, and we&rsquo;ll delete your request.
          </p>

          <h2 className="display mt-8 text-[20px] text-ink">The product itself</h2>
          <p className="mt-2">
            This notice doesn&rsquo;t cover data you put into Obligraph once you use it. See{" "}
            <Link href="/security" className="font-medium text-accent underline underline-offset-2">
              Security
            </Link>{" "}
            for how the product handles that data.
          </p>
        </div>
      </article>
    </>
  );
}
