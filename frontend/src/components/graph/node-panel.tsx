"use client";

import { ArrowUpRight, CircleDashed } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { RegulatorTag } from "@/components/domain/badges";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { api, type GraphNodeOut, type RegulationSummary, type Subgraph } from "@/lib/api";
import { fmtDate, humanize } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { isPlaceholder, kindInfo, relInfo } from "./graph-style";

export function KindGlyph({ kind, placeholder }: { kind: string; placeholder?: boolean }) {
  const info = kindInfo(kind);
  const color = placeholder ? "var(--node-placeholder)" : `var(${info.colorVar})`;
  const common = placeholder
    ? { fill: "var(--surface-hi)", stroke: color, strokeWidth: 1.4, strokeDasharray: "2 1.6" }
    : { fill: color };
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0" aria-hidden="true">
      {info.shape === "doc" && <rect x="3" y="1.5" width="8" height="11" rx="1.6" {...common} />}
      {info.shape === "seal" && (
        <>
          <circle cx="7" cy="7" r="4.4" {...common} />
          <circle cx="7" cy="7" r="6.1" fill="none" stroke={color} strokeWidth="0.9" />
        </>
      )}
      {info.shape === "circle" && <circle cx="7" cy="7" r="4.6" {...common} />}
      {info.shape === "diamond" && <path d="M7 1.6 L12.4 7 L7 12.4 L1.6 7 Z" {...common} />}
      {info.shape === "hex" && <path d="M7 1.4 L11.9 4.2 L11.9 9.8 L7 12.6 L2.1 9.8 L2.1 4.2 Z" {...common} />}
    </svg>
  );
}

const PROP_LABEL: Record<string, string> = {
  ref_no: "Reference",
  issued_on: "Issued",
  effective_on: "Effective",
  regulator: "Regulator",
  status: "Status",
};

function propValue(k: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if ((k.endsWith("_on") || k.endsWith("_at")) && typeof v === "string") return fmtDate(v);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.map(String).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

interface NeighbourGroup {
  key: string;
  label: string;
  lineage: boolean;
  nodes: GraphNodeOut[];
}

function groupNeighbours(id: string, sub: Subgraph): NeighbourGroup[] {
  const byId = new Map(sub.nodes.map((n) => [n.id, n]));
  const groups = new Map<string, NeighbourGroup>();
  for (const e of sub.edges) {
    const outgoing = e.source === id;
    if (!outgoing && e.target !== id) continue;
    const other = byId.get(outgoing ? e.target : e.source);
    if (!other) continue;
    const rel = relInfo(e.rel);
    const key = `${e.rel}:${outgoing ? "out" : "in"}`;
    const g = groups.get(key) ?? { key, label: outgoing ? rel.out : rel.in, lineage: rel.lineage, nodes: [] };
    if (!g.nodes.some((n) => n.id === other.id)) g.nodes.push(other);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => Number(b.lineage) - Number(a.lineage) || a.label.localeCompare(b.label));
}

/** Find the regulation record behind a graph node (the graph only carries the reference). */
async function findRegulation(node: GraphNodeOut, signal: AbortSignal): Promise<RegulationSummary | null> {
  const ref = typeof node.props.ref_no === "string" ? node.props.ref_no : null;
  const page = await api.regulations.list({ q: ref ?? node.label, limit: 5 }, { signal });
  return page.items.find((r) => (ref && r.ref_no === ref) || r.title === node.label) ?? null;
}

export function NodePanel({
  nodeId,
  fallback,
  onSelect,
}: {
  nodeId: string;
  /** Node from the overview graph, shown while the neighbourhood loads. */
  fallback: GraphNodeOut | undefined;
  onSelect: (id: string) => void;
}) {
  const sub = useQuery<Subgraph>(`gnode:${nodeId}`, (signal) => api.graph.node(nodeId, { signal }));
  const loaded = sub.settled ? sub.data : undefined;
  const node = loaded?.nodes.find((n) => n.id === nodeId) ?? fallback;
  const groups = useMemo(() => (loaded ? groupNeighbours(nodeId, loaded) : []), [loaded, nodeId]);

  const isReg = node?.kind === "regulation";
  const placeholder = node ? isPlaceholder(node.props) : false;
  const reg = useQuery<RegulationSummary | null>(
    node && isReg && !placeholder ? `gnode-reg:${node.id}` : null,
    (signal) => findRegulation(node!, signal),
  );

  if (!node && sub.error) return <ErrorState compact error={sub.error} onRetry={sub.reload} />;
  if (!node) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const info = kindInfo(node.kind);
  const props = Object.entries(node.props).filter(([k]) => k !== "placeholder");

  return (
    <div className="px-6 pb-6 pt-3">
      <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink-3">
        <KindGlyph kind={node.kind} placeholder={placeholder} />
        {info.label}
        {placeholder && <span className="normal-case tracking-normal text-ink-3">· not ingested</span>}
      </p>
      <h2 className="display mt-2 text-[18px] leading-snug">{node.label}</h2>
      <p className="mt-0.5 font-mono text-[11px] text-ink-3">{node.key}</p>

      {isReg && (
        <div className="mt-3">
          {placeholder ? (
            <p className="flex items-start gap-2 rounded-[16px] border border-dashed border-line-strong px-3.5 py-2.5 text-[12.5px] text-ink-2">
              <CircleDashed size={14} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
              Referenced by another instrument but not ingested yet, so there is no regulation record to open.
            </p>
          ) : reg.loading ? (
            <Skeleton className="h-10 w-44 rounded-full" />
          ) : reg.data ? (
            <Link
              href={`/regulations/${reg.data.id}`}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent-grad-text px-5 text-[13px] font-medium text-white shadow-glow hover:brightness-105"
            >
              Open regulation <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          ) : (
            <p className="text-[12.5px] text-ink-3">
              {reg.error ? "Couldn't look up the regulation record." : "No matching regulation record was found for this node."}
            </p>
          )}
        </div>
      )}

      {props.length > 0 && (
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-[20px] bg-surface-2 px-4 py-3.5 shadow-inset-sm">
          {props.map(([k, v]) => (
            <div key={k} className={k === "ref_no" ? "col-span-2 min-w-0" : "min-w-0"}>
              <dt className="mb-0.5 text-[11.5px] text-ink-3">{PROP_LABEL[k] ?? humanize(k)}</dt>
              <dd className={k === "ref_no" ? "break-all font-mono text-[12px]" : "truncate text-[13px]"} title={propValue(k, v)}>
                {k === "regulator" && typeof v === "string" ? <RegulatorTag regulator={v} /> : propValue(k, v)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-5">
        <p className="mb-2 text-[12px] font-medium text-ink-3">Connections</p>
        {sub.loading && !loaded && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        )}
        {sub.error != null && !loaded && <ErrorState compact error={sub.error} onRetry={sub.reload} />}
        {loaded && groups.length === 0 && <p className="text-[12.5px] text-ink-3">This node has no connections.</p>}
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.key}>
              <p className={g.lineage ? "mb-1 text-[12px] font-semibold text-accent" : "mb-1 text-[12px] font-medium text-ink-2"}>
                {g.label} <span className="num font-normal text-ink-3">{g.nodes.length}</span>
              </p>
              <ul className="space-y-0.5">
                {g.nodes.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(n.id)}
                      className="flex w-full items-center gap-2 rounded-[12px] px-2 py-1.5 text-left text-[12.5px] hover:bg-surface-2"
                    >
                      <KindGlyph kind={n.kind} placeholder={isPlaceholder(n.props)} />
                      <span className="min-w-0 flex-1 truncate">{n.label}</span>
                      {typeof n.props.ref_no === "string" && (
                        <span className="hidden shrink-0 font-mono text-[10.5px] text-ink-3 sm:inline">
                          {String(n.props.ref_no).split("/").slice(-2).join("/")}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
