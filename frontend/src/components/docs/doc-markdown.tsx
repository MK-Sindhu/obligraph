// Server-rendered Markdown for docs pages: GFM tables and lists, heading ids for the table of
// contents, and internal links through next/link.

import Link from "next/link";
import type { ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { headingId } from "@/lib/docs";

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in node) return textOf((node as { props: { children?: ReactNode } }).props.children);
  return "";
}

const components: Components = {
  h2({ children }) {
    const id = headingId(textOf(children));
    return (
      <h2 id={id} className="group scroll-mt-28">
        <a href={`#${id}`} className="no-underline! text-inherit!">
          {children}
        </a>
      </h2>
    );
  },
  h3({ children }) {
    const id = headingId(textOf(children));
    return (
      <h3 id={id} className="scroll-mt-28">
        <a href={`#${id}`} className="no-underline! text-inherit!">
          {children}
        </a>
      </h3>
    );
  },
  a({ href, children }) {
    if (href && href.startsWith("/") && !href.startsWith("//")) return <Link href={href}>{children}</Link>;
    if (href?.startsWith("#")) return <a href={href}>{children}</a>;
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="doc-table">
        <table>{children}</table>
      </div>
    );
  },
};

export function DocMarkdown({ body }: { body: string }) {
  return (
    <div className="prose-docs">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {body}
      </Markdown>
    </div>
  );
}
