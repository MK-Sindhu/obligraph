"use client";

// Force-directed canvas. Imported only through next/dynamic with ssr:false (see graph-explorer).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d";
import type { Subgraph } from "@/lib/api";
import { useResolvedTheme } from "@/lib/theme";
import { isPlaceholder, kindInfo, readPalette, relInfo, shortRegLabel, tracePath, withAlpha } from "./graph-style";

interface GNode {
  id: string;
  kind: string;
  label: string;
  key: string;
  props: Record<string, unknown>;
}

interface GLink {
  id: string;
  rel: string;
}

type N = NodeObject<GNode>;
type L = LinkObject<GNode, GLink>;

function endId(end: L["source"]): string {
  if (end === undefined || end === null) return "";
  return typeof end === "object" ? String(end.id) : String(end);
}

export default function GraphCanvas({
  data,
  selectedId,
  onSelect,
}: {
  data: Subgraph;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  // Canvas can't use CSS variables directly: resolve them, again whenever the theme flips.
  const theme = useResolvedTheme();
  const palette = useMemo(() => readPalette(theme), [theme]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods<N, L> | undefined>(undefined);
  const fitted = useRef(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);

  // Track the container size; the canvas needs explicit pixel dimensions.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ width: Math.floor(r.width), height: Math.floor(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // force-graph mutates its input (positions, resolved link ends), so hand it copies.
  const graphData = useMemo(() => {
    const ids = new Set(data.nodes.map((n) => n.id));
    return {
      nodes: data.nodes.map((n) => ({ id: n.id, kind: n.kind, label: n.label, key: n.key, props: n.props })),
      links: data.edges
        .filter((e) => ids.has(e.source) && ids.has(e.target))
        .map((e) => ({ id: e.id, rel: e.rel, source: e.source, target: e.target })),
    };
  }, [data]);

  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of data.edges) {
      if (!m.has(e.source)) m.set(e.source, new Set());
      if (!m.has(e.target)) m.set(e.target, new Set());
      m.get(e.source)!.add(e.target);
      m.get(e.target)!.add(e.source);
    }
    return m;
  }, [data]);

  const ready = size.width > 0 && size.height > 0;
  const focusId = hoverId ?? selectedId;
  const focusSet = useMemo(() => {
    if (!focusId) return null;
    const s = new Set(neighbours.get(focusId) ?? []);
    s.add(focusId);
    return s;
  }, [focusId, neighbours]);

  // Spread the layout a little more than the defaults so labels stay legible.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength?.(-150);
    fg.d3Force("link")?.distance?.((l: L) => (relInfo(l.rel).lineage ? 55 : 42));
    fg.d3ReheatSimulation();
    fitted.current = false;
  }, [graphData, ready]);

  // Bring a node selected from the side panel into view.
  useEffect(() => {
    if (!selectedId) return;
    const n = graphData.nodes.find((x) => x.id === selectedId) as N | undefined;
    if (n && typeof n.x === "number" && typeof n.y === "number") fgRef.current?.centerAt(n.x, n.y, 500);
  }, [selectedId, graphData]);

  const drawNode = useCallback(
    (node: N, ctx: CanvasRenderingContext2D, scale: number) => {
      const info = kindInfo(node.kind);
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const r = info.radius;
      const placeholder = node.kind === "regulation" && isPlaceholder(node.props);
      const dim = focusSet !== null && !focusSet.has(String(node.id));
      const selected = node.id === selectedId;
      const color = placeholder ? palette.placeholder : (palette.node[node.kind] ?? palette.ink3);

      ctx.save();
      ctx.globalAlpha = dim ? 0.18 : 1;

      if (selected) {
        tracePath(ctx, info.shape, x, y, r + 3.2);
        ctx.fillStyle = withAlpha(palette.accent, 0.18);
        ctx.fill();
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = palette.accent;
        ctx.stroke();
      }

      tracePath(ctx, info.shape, x, y, r);
      if (!dim && !placeholder) {
        // Soft extruded look: a small drop shadow under every solid node.
        ctx.shadowColor = palette.shadow;
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 2;
      }
      if (placeholder) {
        ctx.setLineDash([2, 1.6]);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = color;
        ctx.fillStyle = palette.surface;
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = color;
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        if (info.shape === "seal") {
          ctx.beginPath();
          ctx.arc(x, y, r + 1.8, 0, Math.PI * 2);
          ctx.lineWidth = 0.9;
          ctx.strokeStyle = color;
          ctx.stroke();
        }
        if (info.shape === "doc") {
          // Two ruled lines: a document glyph.
          ctx.beginPath();
          ctx.moveTo(x - r * 0.45, y - r * 0.25);
          ctx.lineTo(x + r * 0.45, y - r * 0.25);
          ctx.moveTo(x - r * 0.45, y + r * 0.25);
          ctx.lineTo(x + r * 0.2, y + r * 0.25);
          ctx.lineWidth = 0.8;
          ctx.strokeStyle = palette.surface;
          ctx.stroke();
        }
      }

      // Labels: regulations and regulators always; others when zoomed in or in focus.
      const inFocus = focusSet?.has(String(node.id)) ?? false;
      const always = node.kind === "regulation" || node.kind === "regulator";
      if (always || inFocus || scale >= 1.9) {
        const text =
          node.kind === "regulation"
            ? shortRegLabel(node.label, node.props)
            : node.kind === "regulator"
              ? node.key
              : node.label.length > 30
                ? `${node.label.slice(0, 28)}…`
                : node.label;
        const fontPx = Math.max(10.5 / scale, 2.2);
        const mono = node.kind === "regulation" || node.kind === "regulator";
        ctx.font = `${selected || node.kind === "regulator" ? 600 : 500} ${fontPx}px ${mono ? palette.mono : palette.sans}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const ty = y + r + (info.shape === "doc" ? 3 : 2.5);
        ctx.lineJoin = "round";
        ctx.lineWidth = 3 / scale;
        ctx.strokeStyle = palette.bg;
        ctx.strokeText(text, x, ty);
        ctx.fillStyle = selected ? palette.accent : node.kind === "regulation" || inFocus ? palette.ink : palette.ink2;
        ctx.fillText(text, x, ty);
      }
      ctx.restore();
    },
    [focusSet, palette, selectedId],
  );

  const paintHitArea = useCallback((node: N, color: string, ctx: CanvasRenderingContext2D) => {
    const r = kindInfo(node.kind).radius + 2.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const linkTouchesFocus = useCallback(
    (l: L) => focusId === null || endId(l.source) === focusId || endId(l.target) === focusId,
    [focusId],
  );

  const linkColor = useCallback(
    (l: L) => {
      const base = palette.rel[l.rel] ?? palette.ink3;
      if (!linkTouchesFocus(l)) return withAlpha(base, 0.12);
      return relInfo(l.rel).lineage || focusId !== null ? base : withAlpha(base, 0.85);
    },
    [palette, linkTouchesFocus, focusId],
  );

  return (
    <div ref={wrapRef} className="absolute inset-0" aria-label="Knowledge graph canvas" role="img">
      {ready && (
        <ForceGraph2D<GNode, GLink>
          ref={fgRef}
          graphData={graphData}
          width={size.width}
          height={size.height}
          nodeRelSize={1}
          nodeVal={(n) => {
            const r = kindInfo(n.kind).radius;
            return r * r;
          }}
          nodeLabel={(n) => `${kindInfo(n.kind).label}: ${n.label}`}
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={paintHitArea}
          linkColor={linkColor}
          linkWidth={(l) => (linkTouchesFocus(l) && focusId !== null ? relInfo(l.rel).width + 0.6 : relInfo(l.rel).width)}
          linkLineDash={(l) => relInfo(l.rel).dash}
          linkDirectionalArrowLength={(l) => (relInfo(l.rel).arrow ? 5 : 0)}
          linkDirectionalArrowRelPos={1}
          linkDirectionalArrowColor={linkColor}
          linkLabel={(l) => relInfo(l.rel).label}
          cooldownTicks={140}
          minZoom={0.4}
          maxZoom={8}
          onNodeClick={(n) => onSelect(String(n.id))}
          onBackgroundClick={() => onSelect(null)}
          onNodeHover={(n) => setHoverId(n ? String(n.id) : null)}
          onEngineStop={() => {
            if (!fitted.current) {
              fitted.current = true;
              fgRef.current?.zoomToFit(400, 64);
              // Small graphs would otherwise be blown up to giant nodes.
              window.setTimeout(() => {
                const fg = fgRef.current;
                if (fg && fg.zoom() > 2.4) fg.zoom(2.4, 300);
              }, 450);
            }
          }}
        />
      )}
    </div>
  );
}
