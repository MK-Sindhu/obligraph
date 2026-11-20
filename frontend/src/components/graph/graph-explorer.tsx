"use client";

import clsx from "clsx";
import { CalendarClock, MousePointerClick, Network, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Button, IconButton, IconTile } from "@/components/ui/button";
import { FilterSelect, Segmented, Toggle } from "@/components/ui/misc";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { api, type Subgraph } from "@/lib/api";
import { useQuery } from "@/lib/use-query";
import { useUrlState } from "@/lib/url-state";
import { useVocab } from "@/lib/vocab";
import { KINDS, RELS } from "./graph-style";
import { InForceTool } from "./in-force-tool";
import { KindGlyph, NodePanel } from "./node-panel";

// The force-graph library touches window/canvas at import time: browser only.
const GraphCanvas = dynamic(() => import("./graph-canvas"), {
  ssr: false,
  loading: () => <LoadingBlock label="Drawing the graph…" className="h-full" />,
});

function RelSwatch({ colorVar, dash, width, arrow }: { colorVar: string; dash: number[] | null; width: number; arrow: boolean }) {
  return (
    <svg width="26" height="8" viewBox="0 0 26 8" className="shrink-0" aria-hidden="true">
      <line
        x1="1"
        y1="4"
        x2={arrow ? 19 : 25}
        y2="4"
        stroke={`var(${colorVar})`}
        strokeWidth={width}
        strokeDasharray={dash ? dash.map((d) => d * 1.4).join(" ") : undefined}
      />
      {arrow && <path d="M19 1 L25 4 L19 7 Z" fill={`var(${colorVar})`} />}
    </svg>
  );
}

function Legend({ data }: { data: Subgraph }) {
  const [open, setOpen] = useState(true);
  const presentRels = new Set(data.edges.map((e) => e.rel));
  const counts = new Map<string, number>();
  for (const n of data.nodes) counts.set(n.kind, (counts.get(n.kind) ?? 0) + 1);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto h-8 rounded-full border border-line-strong/70 bg-surface-grad px-3.5 text-[12px] font-medium text-ink-2 shadow-raised-xs hover:text-accent"
      >
        Show legend
      </button>
    );
  }
  return (
    <div className="pointer-events-auto rounded-[22px] soft-sm px-4 py-3.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[11.5px] font-medium text-ink-3">Nodes</p>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full px-1.5 text-[11.5px] font-medium text-accent hover:underline">
          Hide
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
        {KINDS.map((k) => (
          <li key={k.kind} className="flex items-center gap-1.5 text-[12px] text-ink-2">
            <KindGlyph kind={k.kind} />
            {k.label}
            <span className="num text-ink-3">{counts.get(k.kind) ?? 0}</span>
          </li>
        ))}
      </ul>
      <p className="mb-2 mt-3 text-[11.5px] font-medium text-ink-3">Relations</p>
      <ul className="space-y-1">
        {RELS.filter((r) => presentRels.has(r.rel) || r.lineage).map((r) => (
          <li key={r.rel} className={clsx("flex items-center gap-2 text-[12px]", r.lineage ? "font-medium text-ink" : "text-ink-2")}>
            <RelSwatch colorVar={r.colorVar} dash={r.dash} width={r.width} arrow={r.arrow} />
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SelectionHint() {
  return (
    <div className="p-6">
      <IconTile tone="accent" size="md">
        <MousePointerClick size={18} />
      </IconTile>
      <p className="display mt-4 text-[16px]">Select a node</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
        Each regulation links to the regulator that issued it, the entity types it applies to, the topics it covers
        and the acts it derives from. Blue arrows mark amendments, orange arrows mark supersession; follow them to
        see which version of a rule is current.
      </p>
      <p className="mt-3 text-[12px] text-ink-3">Scroll to zoom, drag to pan, drag a node to pull it apart.</p>
    </div>
  );
}

export function GraphExplorer() {
  const { get, set } = useUrlState();
  const { vocab } = useVocab();
  const mine = get("mine") === "1";
  const topic = get("topic");
  const nodeId = get("node") || null;
  const panel: "node" | "inforce" = get("panel") === "inforce" ? "inforce" : "node";

  const graph = useQuery<Subgraph>(`graph:${mine}:${topic}`, (signal) =>
    api.graph.overview({ mine, topic: topic || undefined, limit: 300 }, { signal }),
  );
  const data = graph.data;
  const nodeById = useMemo(() => new Map((data?.nodes ?? []).map((n) => [n.id, n])), [data]);

  const select = (id: string | null) => set({ node: id, panel: null });
  const panelOpen = panel === "inforce" || nodeId !== null;

  return (
    <div className="flex h-[calc(100dvh-76px)] min-h-[560px] flex-col px-4 pb-6 sm:px-8">
      <title>Knowledge graph · Obligraph</title>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-5 pt-2">
        <div className="min-w-0">
          <p className="mb-1 text-[12.5px] text-ink-3">Regulatory corpus</p>
          <h1 className="display text-[28px] leading-tight sm:text-[32px]">Knowledge graph</h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Toggle checked={mine} onChange={(v) => set({ mine: v ? 1 : null })} label="Only what applies to us" />
          <FilterSelect
            label="Topic"
            value={topic}
            onChange={(v) => set({ topic: v })}
            allLabel="All topics"
            className="w-[240px]"
            options={(vocab?.topics ?? []).map((t) => ({ value: t.key, label: t.label }))}
          />
          <Button
            size="sm"
            className="lg:hidden"
            variant={panel === "inforce" ? "primary" : "secondary"}
            icon={<CalendarClock size={14} />}
            onClick={() => set({ panel: panel === "inforce" ? null : "inforce" })}
          >
            In force on date
          </Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 gap-6">
        <div className="relative min-w-0 flex-1 rounded-card soft p-2.5">
          <div className="relative h-full overflow-hidden rounded-[22px] bg-[var(--graph-bg)] shadow-inset">
          {graph.error != null && !data && (
            <div className="flex h-full items-center justify-center">
              <ErrorState error={graph.error} onRetry={graph.reload} title="Couldn't load the graph" />
            </div>
          )}
          {!data && !graph.error && <LoadingBlock label="Loading the graph…" className="h-full" />}
          {data && data.nodes.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                icon={<Network size={22} />}
                title="Nothing to draw for these filters"
                action={
                  <Button size="sm" onClick={() => set({ mine: null, topic: null })}>
                    Clear filters
                  </Button>
                }
              >
                {mine
                  ? "No ingested instrument applies to your entity types on this topic yet."
                  : "No ingested instrument covers this topic yet."}
              </EmptyState>
            </div>
          )}
          {data && data.nodes.length > 0 && (
            <>
              <GraphCanvas data={data} selectedId={nodeId} onSelect={select} />
              <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
                <span className="num rounded-full soft-xs px-3 py-1.5 text-[11.5px] font-medium text-ink-2">
                  {data.nodes.length} nodes · {data.edges.length} links
                </span>
                {graph.loading && <span className="text-[11.5px] text-ink-3">Updating…</span>}
              </div>
              <div className="pointer-events-none absolute bottom-3 left-3 hidden max-w-[320px] sm:block">
                <Legend data={data} />
              </div>
            </>
          )}
          </div>
        </div>

        <aside
          aria-label="Graph details"
          className={clsx(
            "flex-col overflow-hidden rounded-card soft",
            "lg:static lg:flex lg:w-[350px] lg:max-h-none lg:shrink-0",
            panelOpen ? "absolute inset-x-0 bottom-0 z-10 flex max-h-[68%] shadow-pop!" : "hidden",
          )}
        >
          <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
            <Segmented
              size="sm"
              label="Side panel"
              value={panel}
              onChange={(v) => set({ panel: v === "inforce" ? "inforce" : null })}
              options={[
                { value: "node", label: "Selection" },
                { value: "inforce", label: "In force on date" },
              ]}
            />
            <IconButton label="Close panel" size="sm" className="lg:hidden" onClick={() => set({ node: null, panel: null })}>
              <X size={15} />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {panel === "inforce" ? (
              <InForceTool />
            ) : nodeId ? (
              <NodePanel key={nodeId} nodeId={nodeId} fallback={nodeById.get(nodeId)} onSelect={(id) => select(id)} />
            ) : (
              <SelectionHint />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
