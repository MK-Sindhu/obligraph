// Visual vocabulary for the knowledge graph: node kinds, relation styles, colours.

import { cssVar } from "@/lib/theme";
import { humanize } from "@/lib/format";

export type NodeKind = "regulation" | "regulator" | "entity_class" | "topic" | "act";
export type Shape = "doc" | "seal" | "circle" | "diamond" | "hex";

export const KINDS: { kind: NodeKind; label: string; colorVar: string; shape: Shape; radius: number }[] = [
  { kind: "regulation", label: "Regulation", colorVar: "--node-regulation", shape: "doc", radius: 6 },
  { kind: "regulator", label: "Regulator", colorVar: "--node-regulator", shape: "seal", radius: 7 },
  { kind: "entity_class", label: "Entity type", colorVar: "--node-entity", shape: "circle", radius: 5 },
  { kind: "topic", label: "Topic", colorVar: "--node-topic", shape: "diamond", radius: 4.5 },
  { kind: "act", label: "Act", colorVar: "--node-act", shape: "hex", radius: 5 },
];

const KIND_BY_KEY = new Map(KINDS.map((k) => [k.kind as string, k]));

export function kindInfo(kind: string) {
  return KIND_BY_KEY.get(kind) ?? { kind, label: humanize(kind), colorVar: "--ink-3", shape: "circle" as Shape, radius: 4.5 };
}

export interface RelStyle {
  rel: string;
  label: string;
  colorVar: string;
  dash: number[] | null;
  width: number;
  arrow: boolean;
  /** Lineage relations are drawn prominently. */
  lineage: boolean;
  /** Wording from the source node's side, and from the target node's side. */
  out: string;
  in: string;
}

export const RELS: RelStyle[] = [
  { rel: "AMENDS", label: "Amends", colorVar: "--accent", dash: null, width: 2.2, arrow: true, lineage: true, out: "Amends", in: "Amended by" },
  { rel: "SUPERSEDES", label: "Supersedes", colorVar: "--sev-high", dash: null, width: 2.2, arrow: true, lineage: true, out: "Supersedes", in: "Superseded by" },
  { rel: "ISSUED_BY", label: "Issued by", colorVar: "--ink-3", dash: null, width: 1, arrow: false, lineage: false, out: "Issued by", in: "Issued" },
  { rel: "APPLIES_TO", label: "Applies to", colorVar: "--edge-default", dash: null, width: 1, arrow: false, lineage: false, out: "Applies to", in: "Regulated by" },
  { rel: "COVERS", label: "Covers topic", colorVar: "--edge-default", dash: [1.5, 2], width: 1, arrow: false, lineage: false, out: "Covers", in: "Covered by" },
  { rel: "DERIVED_FROM", label: "Derived from act", colorVar: "--ink-3", dash: [4, 2.5], width: 1, arrow: false, lineage: false, out: "Derived from", in: "Basis for" },
  { rel: "REFERENCES", label: "References", colorVar: "--ink-3", dash: [1, 3], width: 1, arrow: true, lineage: false, out: "References", in: "Referenced by" },
];

const REL_BY_KEY = new Map(RELS.map((r) => [r.rel, r]));

export function relInfo(rel: string): RelStyle {
  return (
    REL_BY_KEY.get(rel) ?? {
      rel,
      label: humanize(rel.toLowerCase()),
      colorVar: "--ink-3",
      dash: null,
      width: 1,
      arrow: false,
      lineage: false,
      out: humanize(rel.toLowerCase()),
      in: `${humanize(rel.toLowerCase())} (incoming)`,
    }
  );
}

export interface Palette {
  theme: "light" | "dark";
  node: Record<string, string>;
  placeholder: string;
  rel: Record<string, string>;
  ink: string;
  ink2: string;
  ink3: string;
  /** Canvas background (label halos are drawn in it). */
  bg: string;
  surface: string;
  accent: string;
  shadow: string;
  sans: string;
  mono: string;
}

/** Resolve the graph palette from the active CSS custom properties (browser only). */
export function readPalette(theme: "light" | "dark"): Palette {
  const node: Record<string, string> = {};
  for (const k of KINDS) node[k.kind] = cssVar(k.colorVar) || "#888";
  const rel: Record<string, string> = {};
  for (const r of RELS) rel[r.rel] = cssVar(r.colorVar) || "#999";
  return {
    theme,
    node,
    placeholder: cssVar("--node-placeholder") || "#aaa",
    rel,
    ink: cssVar("--ink") || "#111",
    ink2: cssVar("--ink-2") || "#444",
    ink3: cssVar("--ink-3") || "#777",
    bg: cssVar("--graph-bg") || "#edf1f6",
    surface: cssVar("--surface-hi") || "#fff",
    accent: cssVar("--accent") || "#2348f5",
    shadow: theme === "dark" ? "rgba(0, 0, 0, 0.55)" : "rgba(80, 98, 130, 0.35)",
    sans: cssVar("--font-poppins") || "system-ui, sans-serif",
    mono: cssVar("--font-plex-mono") || "ui-monospace, monospace",
  };
}

/** Apply alpha to a #rrggbb colour (other formats are returned unchanged). */
export function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Short on-canvas label for a regulation: "RBI 2025-26/74" from its reference number. */
export function shortRegLabel(label: string, props: Record<string, unknown>): string {
  const ref = typeof props.ref_no === "string" ? props.ref_no : "";
  const regulator = typeof props.regulator === "string" ? props.regulator : "";
  if (ref) {
    const parts = ref.split("/").filter(Boolean);
    const tail = parts.slice(-2).join("/");
    return regulator ? `${regulator} ${tail}` : tail;
  }
  return label.length > 28 ? `${label.slice(0, 26)}…` : label;
}

export function isPlaceholder(props: Record<string, unknown>): boolean {
  return props.placeholder === true;
}

/** Trace a node shape path centred on (x, y). */
export function tracePath(ctx: CanvasRenderingContext2D, shape: Shape, x: number, y: number, r: number) {
  ctx.beginPath();
  switch (shape) {
    case "doc": {
      const w = r * 1.7;
      const h = r * 2.15;
      const c = r * 0.35;
      ctx.roundRect(x - w / 2, y - h / 2, w, h, c);
      break;
    }
    case "diamond":
      ctx.moveTo(x, y - r * 1.25);
      ctx.lineTo(x + r * 1.25, y);
      ctx.lineTo(x, y + r * 1.25);
      ctx.lineTo(x - r * 1.25, y);
      ctx.closePath();
      break;
    case "hex":
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        const px = x + r * 1.1 * Math.cos(a);
        const py = y + r * 1.1 * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    default:
      ctx.arc(x, y, r, 0, Math.PI * 2);
  }
}
