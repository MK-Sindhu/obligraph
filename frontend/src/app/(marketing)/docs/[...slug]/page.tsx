import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocMarkdown } from "@/components/docs/doc-markdown";
import { allDocs, getDoc, neighbours } from "@/lib/docs";

export const dynamicParams = false;

export function generateStaticParams() {
  return allDocs().map((d) => ({ slug: d.slug.split("/") }));
}

export async function generateMetadata({ params }: PageProps<"/docs/[...slug]">): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug.join("/"));
  if (!doc) return {};
  return {
    title: `${doc.title} · Docs`,
    description: doc.description,
    alternates: { canonical: doc.href },
    openGraph: { title: `${doc.title} · Obligraph docs`, description: doc.description, url: doc.href, type: "article" },
  };
}

export default async function DocPage({ params }: PageProps<"/docs/[...slug]">) {
  const { slug } = await params;
  const doc = getDoc(slug.join("/"));
  if (!doc) notFound();
  const { prev, next } = neighbours(doc.slug);
  const toc = doc.headings;

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_210px]">
      <article className="card relative min-w-0 rounded-card px-6 py-8 sm:px-10 sm:py-10">
        <nav aria-label="Breadcrumb" className="text-[12px] font-semibold text-ink-3">
          <Link href="/docs" className="hover:text-accent">
            Docs
          </Link>
          <span className="px-1.5" aria-hidden="true">
            /
          </span>
          <span>{doc.groupLabel}</span>
        </nav>
        <h1 className="display mt-2 text-[30px] font-extrabold leading-tight text-ink">{doc.title}</h1>
        {doc.description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">{doc.description}</p>}
        <hr className="my-7 border-line" />
        <DocMarkdown body={doc.body} />
        {(prev || next) && (
          <nav aria-label="Previous and next pages" className="mt-12 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
            {prev ? (
              <Link href={prev.href} className="group rounded-[16px] border border-line px-4 py-3 hover:border-primary">
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-3">
                  <ArrowLeft size={13} aria-hidden="true" /> Previous
                </span>
                <span className="mt-0.5 block text-[14px] font-semibold text-ink group-hover:text-accent">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link href={next.href} className="group rounded-[16px] border border-line px-4 py-3 text-right hover:border-primary">
                <span className="flex items-center justify-end gap-1.5 text-[12px] font-semibold text-ink-3">
                  Next <ArrowRight size={13} aria-hidden="true" />
                </span>
                <span className="mt-0.5 block text-[14px] font-semibold text-ink group-hover:text-accent">{next.title}</span>
              </Link>
            )}
          </nav>
        )}
      </article>
      {toc.length > 1 && (
        <aside aria-label="On this page" className="hidden xl:block">
          <div className="sticky top-[96px]">
            <p className="label-caps text-[11px] text-accent-deep!">On this page</p>
            <ul className="mt-3 space-y-1.5 border-l-2 border-white/60 text-[13px]">
              {toc.map((h) => (
                <li key={h.id}>
                  <a
                    href={`#${h.id}`}
                    className={h.depth === 3 ? "-ml-[2px] block border-l-2 border-transparent py-0.5 pl-6 text-on-canvas-2 hover:border-primary hover:text-on-canvas" : "-ml-[2px] block border-l-2 border-transparent py-0.5 pl-3 font-semibold text-on-canvas-2 hover:border-primary hover:text-on-canvas"}
                  >
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </div>
  );
}
