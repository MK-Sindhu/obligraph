// Docs content: Markdown files under src/content/docs/<group>/<page>.md with frontmatter
// (title, description, order). Read at build time; every docs page is statically generated.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "src", "content", "docs");

/** Sidebar groups, in order. The key is the folder name. */
export const DOC_GROUPS: { key: string; label: string }[] = [
  { key: "getting-started", label: "Getting started" },
  { key: "concepts", label: "Concepts" },
  { key: "using", label: "Using Obligraph" },
  { key: "admin", label: "Administration" },
  { key: "deploy", label: "Deploy" },
  { key: "security", label: "Security and data" },
  { key: "faq", label: "FAQ" },
];

export interface DocHeading {
  depth: 2 | 3;
  text: string;
  id: string;
}

export interface DocMeta {
  /** "concepts/sbr-layers" */
  slug: string;
  href: string;
  group: string;
  groupLabel: string;
  title: string;
  description: string;
  order: number;
  headings: DocHeading[];
}

export interface Doc extends DocMeta {
  body: string;
}

/** Heading text → id. Shared with the renderer so the table of contents links resolve. */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** Strip inline Markdown (links, emphasis, code) from a heading line. */
function plain(md: string): string {
  return md
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
}

function parse(file: string, group: string): Doc {
  const raw = fs.readFileSync(file, "utf8");
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!m) throw new Error(`Docs page without frontmatter: ${file}`);
  const fm: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = /^(\w+):\s*(.*)$/.exec(line);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  const body = m[2].trim();
  const headings: DocHeading[] = [];
  let fence = false;
  for (const line of body.split("\n")) {
    if (/^\s*```/.test(line)) fence = !fence;
    if (fence) continue;
    const h = /^(##|###)\s+(.+?)\s*#*\s*$/.exec(line);
    if (h) {
      const text = plain(h[2]);
      headings.push({ depth: h[1].length as 2 | 3, text, id: headingId(text) });
    }
  }
  const name = path.basename(file, ".md");
  const slug = `${group}/${name}`;
  return {
    slug,
    href: `/docs/${slug}`,
    group,
    groupLabel: DOC_GROUPS.find((g) => g.key === group)?.label ?? group,
    title: fm.title ?? name,
    description: fm.description ?? "",
    order: Number(fm.order ?? 99),
    headings,
    body,
  };
}

let cache: Doc[] | null = null;

/** All pages in reading order (group order, then frontmatter order). */
export function allDocs(): Doc[] {
  if (cache) return cache;
  const docs: Doc[] = [];
  for (const g of DOC_GROUPS) {
    const dir = path.join(ROOT, g.key);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".md")) docs.push(parse(path.join(dir, f), g.key));
    }
  }
  const groupIndex = (k: string) => DOC_GROUPS.findIndex((g) => g.key === k);
  docs.sort((a, b) => groupIndex(a.group) - groupIndex(b.group) || a.order - b.order || a.title.localeCompare(b.title));
  cache = docs;
  return docs;
}

export function getDoc(slug: string): Doc | undefined {
  return allDocs().find((d) => d.slug === slug);
}

/** Metadata only (no bodies): for the sidebar and the search index sent to the browser. */
export function docIndex(): DocMeta[] {
  return allDocs().map((d) => ({
    slug: d.slug,
    href: d.href,
    group: d.group,
    groupLabel: d.groupLabel,
    title: d.title,
    description: d.description,
    order: d.order,
    headings: d.headings,
  }));
}

export function neighbours(slug: string): { prev?: DocMeta; next?: DocMeta } {
  const list = docIndex();
  const i = list.findIndex((d) => d.slug === slug);
  return { prev: i > 0 ? list[i - 1] : undefined, next: i >= 0 && i < list.length - 1 ? list[i + 1] : undefined };
}
