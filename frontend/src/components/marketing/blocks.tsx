// Building blocks for the marketing pages. Server components (no client JS).

import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { glassClass } from "@/components/ui/glass";
import { buttonClass, iconTileClass } from "@/components/ui/styles";
import { SHOTS, type ShotName } from "./shots";

/** Small frosted label above a heading. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={clsx("glass-subtle inline-flex max-w-full items-center gap-2 rounded-full px-3.5 py-1.5 text-left text-[12.5px] font-medium leading-snug text-ink-2", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-accent-grad-diag" aria-hidden="true" />
      {children}
    </p>
  );
}

/**
 * A product screenshot on glass, in the visitor's theme (only the visible image is fetched).
 * Every shot is captioned "Sample data".
 */
export function ThemeShot({
  name,
  caption,
  sizes = "(min-width: 1024px) 560px, 100vw",
  priority,
  maxHeight,
  className,
}: {
  name: ShotName;
  caption?: ReactNode;
  sizes?: string;
  /** Above-the-fold hero image: fetch it early (lazy-safe, so only one theme loads). */
  priority?: boolean;
  /** Crop tall screenshots from the top. */
  maxHeight?: number;
  className?: string;
}) {
  const shot = SHOTS[name];
  const img = "h-auto w-full";
  return (
    <figure className={glassClass("default", "lg", clsx("p-2.5 sm:p-3", className))}>
      <div className="relative overflow-hidden rounded-[26px]" style={maxHeight ? { maxHeight } : undefined}>
        <Image src={shot.light} alt={shot.alt} sizes={sizes} placeholder="blur" fetchPriority={priority ? "high" : undefined} className={clsx(img, "theme-light-only")} />
        <Image src={shot.dark} alt={shot.alt} sizes={sizes} placeholder="blur" fetchPriority={priority ? "high" : undefined} className={clsx(img, "theme-dark-only")} />
        {maxHeight && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--canvas)] to-transparent opacity-80" />
        )}
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-2 pb-0.5 pt-2.5 text-[12px] text-ink-2">
        <span className="rounded-full bg-[var(--sev-medium-bg)] px-2 py-[3px] text-[11px] font-semibold leading-none text-warn">Sample data</span>
        {caption && <span>{caption}</span>}
      </figcaption>
    </figure>
  );
}

export function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  className,
  center,
}: {
  id?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  children?: ReactNode;
  className?: string;
  center?: boolean;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={clsx("mx-auto w-full max-w-[1200px] scroll-mt-28 px-4 py-16 sm:px-8 sm:py-20", className)}>
      <div className={clsx("max-w-[760px]", center && "mx-auto text-center")}>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 id={headingId} className={clsx("display text-[28px] leading-[1.15] text-ink sm:text-[36px]", eyebrow && "mt-4")}>
          {title}
        </h2>
        {intro && <p className="mt-4 text-[15.5px] leading-relaxed text-ink-2">{intro}</p>}
      </div>
      {children && <div className="mt-10">{children}</div>}
    </section>
  );
}

export function FeatureCard({ icon, title, children, className }: { icon: ReactNode; title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <article className={glassClass("default", "tile", clsx("flex flex-col px-6 pb-6 pt-5", className))}>
      <span aria-hidden="true" className={iconTileClass("accent", "md")}>
        {icon}
      </span>
      <h3 className="display mt-4 text-[16.5px] leading-snug text-ink">{title}</h3>
      <div className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{children}</div>
    </article>
  );
}

/** Ticked list of plain statements of what a module does. */
export function DoesList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-6 space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-ink-2">
          <span aria-hidden="true" className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-accent-grad-diag shadow-glow-sm" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function CtaLinks({ className, secondary = { href: "/login", label: "Sign in" } }: { className?: string; secondary?: { href: string; label: string } | null }) {
  return (
    <div className={clsx("flex flex-wrap items-center gap-3", className)}>
      <Link href="/contact" className={buttonClass("primary", "lg")}>
        Request a demo <ArrowRight size={16} aria-hidden="true" />
      </Link>
      {secondary && (
        <Link href={secondary.href} className={buttonClass("secondary", "lg")}>
          {secondary.label}
        </Link>
      )}
    </div>
  );
}

export function CtaBand({ title, body }: { title: string; body: string }) {
  return (
    <section aria-labelledby="cta-band-title" className="mx-auto w-full max-w-[1200px] px-4 pb-20 sm:px-8">
      <div className={glassClass("strong", "lg", "relative overflow-hidden px-6 py-12 text-center sm:px-14 sm:py-16")}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[70%] -translate-x-1/2 rounded-full"
          style={{ background: "radial-gradient(closest-side, var(--blob-blue), transparent)" }}
        />
        <h2 id="cta-band-title" className="display relative text-[26px] leading-tight text-ink sm:text-[34px]">
          {title}
        </h2>
        <p className="relative mx-auto mt-3 max-w-[620px] text-[15px] leading-relaxed text-ink-2">{body}</p>
        <CtaLinks className="relative mt-8 justify-center" secondary={{ href: "/product", label: "See the product" }} />
      </div>
    </section>
  );
}

/** Page hero for the inner marketing pages. */
export function PageIntro({ eyebrow, title, intro }: { eyebrow: string; title: ReactNode; intro: ReactNode }) {
  return (
    <header className="mx-auto w-full max-w-[1200px] px-4 pb-6 pt-14 sm:px-8 sm:pt-20">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="display mt-5 max-w-[860px] text-[34px] leading-[1.1] text-ink sm:text-[48px]">{title}</h1>
      <p className="mt-5 max-w-[720px] text-[16px] leading-relaxed text-ink-2">{intro}</p>
    </header>
  );
}
