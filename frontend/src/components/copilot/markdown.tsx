"use client";

import clsx from "clsx";
import Link from "next/link";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  a({ href, children }) {
    if (href && href.startsWith("/") && !href.startsWith("//")) {
      return <Link href={href}>{children}</Link>;
    }
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="-mx-1 overflow-x-auto px-1">
        <table>{children}</table>
      </div>
    );
  },
};

/** GitHub-flavoured markdown (tables, lists, links) in the answer typography. */
export function AnswerMarkdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={clsx("prose-answer min-w-0 break-words", className)}>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </Markdown>
    </div>
  );
}
