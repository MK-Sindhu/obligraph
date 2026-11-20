"use client";

import { RegStatusBadge } from "@/components/domain/badges";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import type { GraphEdgeOut, Lineage, LineageItem } from "@/lib/api";
import { fmtDate, fmtShortDate } from "@/lib/format";

const IN_VERB: Record<string, string> = { AMENDS: "Amended by", SUPERSEDES: "Superseded by" };
const OUT_VERB: Record<string, string> = { AMENDS: "Amends", SUPERSEDES: "Supersedes" };

function refOf(item: LineageItem | undefined): string {
  if (!item) return "an unknown instrument";
  return item.ref_no ?? item.title;
}

/**
 * An instrument's family as a horizontal timeline, oldest first: everything it amends or
 * supersedes and everything that later amends or supersedes it. The focus instrument is the
 * active (blue) step; instruments referenced but not yet ingested are hollow. The segment
 * between two neighbours names the relation ("Superseded by · from 30 Jun 2026").
 */
export function LineageTimeline({ lineage }: { lineage: Lineage }) {
  const byNode = new Map(lineage.items.map((i) => [i.node_id, i]));
  const items = lineage.items;

  const between = (a: LineageItem, b: LineageItem): GraphEdgeOut | undefined =>
    lineage.edges.find(
      (e) => (e.source === a.node_id && e.target === b.node_id) || (e.source === b.node_id && e.target === a.node_id),
    );

  const steps: TimelineItem[] = items.map((item, idx) => {
    const prev = idx > 0 ? items[idx - 1] : undefined;
    const link = prev ? between(prev, item) : undefined;
    const placeholder = item.status === "not_ingested" || !item.regulation_id;
    // Relations that aren't drawn as a connector between neighbours.
    const others = lineage.edges.filter((e) => {
      if (e === link) return false;
      const next = items[idx + 1];
      if (next && e === between(item, next)) return false;
      return e.source === item.node_id || e.target === item.node_id;
    });

    let connector: string | undefined;
    if (link && prev) {
      // Reading left to right (older → newer): the newer instrument acts on the older one.
      const verb = link.source === item.node_id ? IN_VERB[link.rel] : OUT_VERB[link.rel];
      connector = `${verb ?? link.rel}${link.valid_from ? ` · ${fmtShortDate(link.valid_from)}` : ""}`;
    }

    return {
      id: item.node_id,
      pill: item.ref_no ?? "No reference",
      title: item.title,
      meta: placeholder ? "Referenced, not ingested yet" : item.issued_on ? `Issued ${fmtDate(item.issued_on)}` : "Issue date unknown",
      active: item.is_focus,
      muted: placeholder,
      href: !item.is_focus && !placeholder && item.regulation_id ? `/regulations/${item.regulation_id}` : undefined,
      connector,
      connectorTone: link?.rel === "SUPERSEDES" ? "warn" : "accent",
      extra: (
        <span className="mt-2 flex flex-col items-center gap-1.5">
          {!placeholder && <RegStatusBadge status={item.status} />}
          {others.map((e) => {
            const outgoing = e.source === item.node_id;
            const other = byNode.get(outgoing ? e.target : e.source);
            return (
              <span key={e.id} className="text-[11px] text-ink-3">
                <span className={e.rel === "SUPERSEDES" ? "text-[color:var(--sev-high)]" : "text-accent"}>
                  {(outgoing ? OUT_VERB : IN_VERB)[e.rel] ?? e.rel}
                </span>{" "}
                {refOf(other)}
              </span>
            );
          })}
        </span>
      ),
    };
  });

  return <Timeline items={steps} ariaLabel="Lineage of this instrument, oldest first" minItemWidth={200} />;
}
