// Building blocks for the marketing pages. Server components (no client JS).

import clsx from "clsx";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass, cardClass, iconTileClass } from "@/components/ui/styles";

/** Bold blue uppercase label above a heading. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("text-[12px] font-extrabold uppercase tracking-[0.1em] text-accent-deep", className)}>{children}</p>;
}

/** Section with a short headline (8 words or fewer) and at most one line under it. */
export function Section({
  id,
  eyebrow,
  title,
  line,
  children,
  className,
  center,
}: {
  id?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  line?: ReactNode;
  children?: ReactNode;
  className?: string;
  center?: boolean;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={clsx("mx-auto w-full max-w-[1200px] scroll-mt-28 px-4 py-14 sm:px-8 sm:py-16", className)}>
      <div className={clsx(center && "text-center")}>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 id={headingId} className={clsx("display text-[28px] font-extrabold leading-[1.12] text-on-canvas sm:text-[36px]", eyebrow && "mt-2")}>
          {title}
        </h2>
        {line && <p className={clsx("mt-3 text-[16px] text-on-canvas-2", center && "mx-auto max-w-[620px]")}>{line}</p>}
      </div>
      {children && <div className="mt-9">{children}</div>}
    </section>
  );
}

/** Icon tile + title + one short line (12 words or fewer). */
export function FeatureTile({
  icon,
  title,
  line,
  href,
  selected,
  className,
}: {
  icon: ReactNode;
  title: ReactNode;
  line: ReactNode;
  href?: string;
  /** Steel-blue tile, as on the reference's selected state. */
  selected?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <span aria-hidden="true" className={iconTileClass(selected ? "selected" : "soft", "xl", "shrink-0 [&_svg]:size-6")}>
        {icon}
      </span>
      {/* Icon beside the text on phones, above it from sm up. */}
      <span className="block min-w-0 sm:mt-4">
        <span className="block text-[15px] font-bold leading-snug text-ink">{title}</span>
        <span className="mt-1 block text-[13px] leading-snug text-ink-3">{line}</span>
      </span>
    </>
  );
  const cls = cardClass("raised", "tile", clsx("flex items-center gap-4 p-4 sm:block sm:p-5", className));
  return href ? (
    <Link href={href} className={clsx(cls, "transition-[border-color] hover:border-primary")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Short ticked points (a few words each), never paragraphs. */
export function Ticks({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <ul className={clsx("space-y-2.5", className)}>
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[14.5px] font-medium leading-snug text-on-canvas">
          <span aria-hidden="true" className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-fill text-white">
            <Check size={12} strokeWidth={3} />
          </span>
          {it}
        </li>
      ))}
    </ul>
  );
}

export function DocsLink({ href, children = "Read the docs" }: { href: string; children?: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-[6px] text-[13.5px] font-bold text-accent-deep hover:underline">
      {children} <ArrowRight size={14} aria-hidden="true" />
    </Link>
  );
}

export function CtaLinks({ className, secondary = { href: "/login", label: "Sign in" } }: { className?: string; secondary?: { href: string; label: string } | null }) {
  return (
    <div className={clsx("flex flex-wrap items-center gap-3", className)}>
      <Link href="/contact" className={buttonClass("primary", "lg", "uppercase tracking-[0.06em]")}>
        Request a demo
      </Link>
      {secondary && (
        <Link href={secondary.href} className={buttonClass("secondary", "lg")}>
          {secondary.label}
        </Link>
      )}
    </div>
  );
}

export function CtaBand({ title, line }: { title: string; line?: string }) {
  return (
    <section aria-labelledby="cta-band-title" className="mx-auto w-full max-w-[1200px] px-4 pb-16 sm:px-8">
      <div className={cardClass("raised", "lg", "relative flex flex-col items-start gap-6 px-6 py-10 sm:px-12 md:flex-row md:items-center")}>
        <span aria-hidden="true" className="corner-tab" />
        <div className="min-w-0 flex-1">
          <h2 id="cta-band-title" className="display text-[26px] font-extrabold leading-tight text-ink sm:text-[30px]">
            {title}
          </h2>
          {line && <p className="mt-2 text-[15px] text-ink-3">{line}</p>}
        </div>
        <CtaLinks secondary={{ href: "/docs", label: "Read the docs" }} />
      </div>
    </section>
  );
}

/** Page hero for the inner marketing pages: label, headline, one line. */
export function PageIntro({ eyebrow, title, line }: { eyebrow: string; title: ReactNode; line: ReactNode }) {
  return (
    <header className="mx-auto w-full max-w-[1200px] px-4 pb-4 pt-12 sm:px-8 sm:pt-16">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="display mt-3 max-w-[820px] text-[36px] font-extrabold leading-[1.06] text-on-canvas sm:text-[52px]">{title}</h1>
      <p className="mt-4 max-w-[640px] text-[17px] text-on-canvas-2">{line}</p>
    </header>
  );
}

/** Anchor chips for jumping to a page's sections. */
export function JumpChips({ items, label }: { items: { id: string; name: string }[]; label: string }) {
  return (
    <nav aria-label={label} className="mx-auto w-full max-w-[1200px] px-4 sm:px-8">
      <ul className="flex flex-wrap gap-2">
        {items.map((m) => (
          <li key={m.id}>
            <Link
              href={`#${m.id}`}
              className="inline-flex h-9 items-center rounded-full border border-white/70 bg-surface px-4 text-[13px] font-semibold text-ink-2 shadow-xs hover:border-primary hover:text-accent"
            >
              {m.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
