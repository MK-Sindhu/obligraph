"use client";

import { ArrowLeft, Check, ChevronDown, ExternalLink, MessageSquareText, Minus, TriangleAlert, Waypoints } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { COVERAGE_LABEL, CoverageBadge, CoverageGlyph, ObligationStatusBadge, SeverityBadge, StatusStamp } from "@/components/domain/badges";
import { Docket } from "@/components/domain/docket";
import { LineageTimeline } from "@/components/domain/lineage";
import { ButtonLink } from "@/components/ui/button";
import { Meta, Panel, Tag } from "@/components/ui/misc";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { api, ApiError, type Coverage, type RegulationDetail, type RequirementOut } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDate, FREQUENCY_LABEL, humanize, label } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { useVocab } from "@/lib/vocab";

function RequirementRow({
  req,
  impact,
}: {
  req: RequirementOut;
  impact?: { obligation_id: string; coverage: Coverage };
}) {
  const { topic } = useVocab();
  return (
    <li className="grid grid-cols-[34px_minmax(0,1fr)] gap-x-4 px-6 py-4">
      <span className="num flex h-8 w-8 items-center justify-center rounded-[11px] bg-surface-2 font-mono text-[11.5px] text-ink-2 shadow-inset-sm">
        {String(req.ordinal + 1).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <p className="text-[13.5px] leading-relaxed text-ink">{req.text}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-2">
          <SeverityBadge severity={req.severity} />
          <span>
            <span className="mr-1 text-ink-3">Kind</span>
            {humanize(req.kind)}
          </span>
          <span>
            <span className="mr-1 text-ink-3">Frequency</span>
            {label(FREQUENCY_LABEL, req.frequency)}
          </span>
          <span>
            <span className="mr-1 text-ink-3">Due</span>
            {req.due_on ? <span className="font-medium text-ink">{fmtDate(req.due_on)}</span> : "No fixed date"}
          </span>
          {impact && (
            <Link
              href={`/obligations?id=${impact.obligation_id}`}
              className="ml-auto inline-flex items-center gap-2 rounded-full py-0.5 pl-2 hover:underline"
              title="Open your obligation"
            >
              <span className="text-ink-3">Your coverage</span>
              <CoverageBadge coverage={impact.coverage} />
            </Link>
          )}
        </div>
        {req.source_quote && req.source_quote.trim() !== req.text.trim() ? (
          <details className="group mt-2">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full text-[12px] font-medium text-ink-3 hover:text-accent">
              <ChevronDown size={12} className="transition-transform group-open:rotate-180" aria-hidden="true" /> Source text
            </summary>
            <blockquote className="mt-2 rounded-[16px] bg-surface-2 px-4 py-3 text-[13px] italic leading-relaxed text-ink-2 shadow-inset-sm">
              {req.source_quote}
            </blockquote>
          </details>
        ) : null}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {req.topics.map((t) => (
            <Tag key={t}>{topic(t)}</Tag>
          ))}
          {req.source_quote && req.source_quote.trim() === req.text.trim() && (
            <span className="ml-1 text-[11.5px] text-ink-3">Quoted verbatim from the instrument</span>
          )}
        </div>
        {req.evidence_hint && (
          <p className="mt-1.5 text-[12px] text-ink-3">
            <span className="font-medium text-ink-2">Evidence to keep:</span> {req.evidence_hint}
          </p>
        )}
      </div>
    </li>
  );
}

function ImpactPanel({ reg }: { reg: RegulationDetail }) {
  const { org } = useAuth();
  const { entity } = useVocab();
  const reqById = new Map(reg.requirements.map((r) => [r.id, r]));
  const rows = [...reg.org_impact].sort((a, b) => {
    const order: Record<string, number> = { missing: 0, partial: 1, unassessed: 2, covered: 3 };
    return (order[a.coverage] ?? 9) - (order[b.coverage] ?? 9);
  });
  const counts = rows.reduce<Record<string, number>>((m, r) => ({ ...m, [r.coverage]: (m[r.coverage] ?? 0) + 1 }), {});

  if (!rows.length) {
    return (
      <EmptyState
        compact
        icon={reg.applies_to_org ? <Minus size={20} /> : <Check size={20} />}
        title={reg.status === "superseded" ? "No current obligations" : reg.applies_to_org ? "No obligations yet" : `Doesn't apply to ${org?.name ?? "you"}`}
      >
        {reg.status === "superseded"
          ? "Superseded instruments don't create obligations. Your obligations come from the instrument that replaced it."
          : reg.applies_to_org
          ? "This instrument matches your entity types, but no obligations have been created from it."
          : `It covers ${reg.entity_classes.map(entity).join(", ") || "other entity types"}; your organisation is registered as ${org?.entity_classes.map(entity).join(", ") || "no entity type"}.`}
      </EmptyState>
    );
  }

  const total = rows.length;
  return (
    <div>
      <div className="px-6 pt-1">
        <div
          className="flex h-3 gap-[3px] overflow-hidden rounded-full bg-surface-3 p-[2px] shadow-inset-sm"
          role="img"
          aria-label="Coverage of obligations from this instrument"
        >
          {(["covered", "partial", "missing", "unassessed"] as const).map((k) =>
            counts[k] ? (
              <span key={k} className="rounded-full" style={{ flex: counts[k], background: `var(--cov-${k})` }} title={`${COVERAGE_LABEL[k]}: ${counts[k]}`} />
            ) : null,
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-2">
          {(["covered", "partial", "missing", "unassessed"] as const)
            .filter((k) => counts[k])
            .map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <CoverageGlyph coverage={k} /> {counts[k]} {COVERAGE_LABEL[k].toLowerCase()}
              </span>
            ))}
          <span className="text-ink-3">of {total}</span>
        </div>
      </div>
      <ul className="mt-3 space-y-0.5 px-3 pb-4">
        {rows.map((r) => (
          <li key={r.obligation_id}>
            <Link href={`/obligations?id=${r.obligation_id}`} className="flex items-start gap-3 rounded-[16px] px-3 py-2.5 transition-colors hover:bg-surface-2">
              <CoverageGlyph coverage={r.coverage} className="mt-1" />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[12.5px] leading-snug text-ink">{reqById.get(r.requirement_id)?.text ?? "Requirement"}</span>
                <span className="mt-1 flex items-center gap-2">
                  <span className="text-[11.5px]" style={{ color: `var(--cov-${r.coverage}-ink)` }}>
                    {COVERAGE_LABEL[r.coverage]}
                  </span>
                  <ObligationStatusBadge status={r.status} />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading regulation">
      <Skeleton className="h-56 rounded-card-lg" />
      <Skeleton className="mt-6 h-40 rounded-card" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-96 rounded-card" />
        <Skeleton className="h-96 rounded-card" />
      </div>
    </div>
  );
}

export default function RegulationPage() {
  const { id } = useParams<{ id: string }>();
  const { topic, entity } = useVocab();
  const q = useQuery<RegulationDetail>(id ? `reg:${id}` : null, (signal) => api.regulations.get(id, { signal }));
  const reg = q.data && q.data.id === id ? q.data : undefined;

  const back = (
    <Link
      href="/regulations"
      className="mb-5 inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong/70 bg-surface-grad px-4 text-[12.5px] font-medium text-ink-2 shadow-raised-xs transition-colors hover:text-accent"
    >
      <ArrowLeft size={14} aria-hidden="true" /> Regulations
    </Link>
  );

  if (q.error && !reg) {
    const notFound = q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 422);
    return (
      <>
        {back}
        <Panel>
          <ErrorState
            error={q.error}
            title={notFound ? "Regulation not found" : undefined}
            onRetry={notFound ? undefined : q.reload}
          />
        </Panel>
      </>
    );
  }
  if (!reg) {
    return (
      <>
        {back}
        <DetailSkeleton />
      </>
    );
  }

  const focus = reg.lineage.items.find((i) => i.is_focus);
  const byNode = new Map(reg.lineage.items.map((i) => [i.node_id, i]));
  const supersededBy = reg.lineage.edges.filter((e) => e.rel === "SUPERSEDES" && e.target === focus?.node_id).map((e) => ({ edge: e, item: byNode.get(e.source) }));
  const amendedBy = reg.lineage.edges.filter((e) => e.rel === "AMENDS" && e.target === focus?.node_id).map((e) => ({ edge: e, item: byNode.get(e.source) }));
  const impactByReq = new Map(reg.org_impact.map((r) => [r.requirement_id, r]));
  const askHref = `/copilot?q=${encodeURIComponent(`Summarise ${reg.ref_no ?? reg.title} and what it means for us.`)}`;

  return (
    <>
      <title>{`${reg.ref_no ?? reg.title} · Obligraph`}</title>
      {back}

      <header className="relative rounded-card-lg soft px-6 pb-7 pt-7 sm:px-9">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1 basis-[460px]">
            <Docket regulator={reg.regulator} refNo={reg.ref_no} date={reg.issued_on} docType={reg.doc_type} />
            <h1 className="display mt-2.5 text-[25px] leading-[1.2] text-ink sm:text-[30px]">{reg.title}</h1>
          </div>
          <div className="pt-1">
            <StatusStamp status={reg.status} size="lg" />
          </div>
        </div>

        {supersededBy.length > 0 && (
          <div className="mt-5 flex items-start gap-2.5 rounded-[18px] border border-[color:var(--sev-high)]/30 bg-[color:var(--sev-high-bg)] px-4 py-3 text-[13px]">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-[color:var(--sev-high)]" aria-hidden="true" />
            <p>
              Superseded by{" "}
              {supersededBy.map(({ edge, item }, i) => (
                <span key={edge.id}>
                  {i > 0 && ", "}
                  {item?.regulation_id ? (
                    <Link href={`/regulations/${item.regulation_id}`} className="font-medium underline underline-offset-2">
                      {item.ref_no ?? item.title}
                    </Link>
                  ) : (
                    <span className="font-medium">{item?.ref_no ?? item?.title ?? "a later instrument"}</span>
                  )}
                  {edge.valid_from && <> from {fmtDate(edge.valid_from)}</>}
                </span>
              ))}
              . Obligations from this instrument are retired once the replacement takes effect.
            </p>
          </div>
        )}
        {amendedBy.length > 0 && supersededBy.length === 0 && (
          <p className="mt-3 text-[13px] text-ink-2">
            Amended by{" "}
            {amendedBy.map(({ edge, item }, i) => (
              <span key={edge.id}>
                {i > 0 && ", "}
                {item?.regulation_id ? (
                  <Link href={`/regulations/${item.regulation_id}`} className="font-medium text-accent hover:underline">
                    {item.ref_no ?? item.title}
                  </Link>
                ) : (
                  item?.ref_no ?? item?.title
                )}
                {edge.valid_from && <> (from {fmtDate(edge.valid_from)})</>}
              </span>
            ))}
            . Read it together with the amendment.
          </p>
        )}

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 [&>div]:rounded-[18px] [&>div]:bg-surface-2 [&>div]:px-4 [&>div]:py-3 [&>div]:shadow-inset-sm">
          <Meta label="Issued">{fmtDate(reg.issued_on)}</Meta>
          <Meta label="Effective">{reg.effective_on ? fmtDate(reg.effective_on) : "On issue"}</Meta>
          <Meta label="Requirements">
            <span className="num">{reg.requirement_count ?? reg.requirements.length}</span>
          </Meta>
          <Meta label="Applies to you">
            {reg.applies_to_org ? (
              <span className="inline-flex items-center gap-1 font-medium text-ok">
                <Check size={13} aria-hidden="true" /> Yes
              </span>
            ) : (
              "No"
            )}
          </Meta>
          <Meta label="Read by">{reg.extracted_by === "offline" ? "Offline extractor" : humanize(reg.extracted_by)}</Meta>
          <Meta label="Source">
            {reg.url ? (
              <a href={reg.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                Regulator site <ExternalLink size={12} aria-hidden="true" />
              </a>
            ) : (
              <span className="text-ink-3">Not recorded</span>
            )}
          </Meta>
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[12px] text-ink-3">Entities</span>
            {reg.entity_classes.length ? reg.entity_classes.map((e) => <Tag key={e}>{entity(e)}</Tag>) : <span className="text-[12px] text-ink-3">All under {reg.regulator}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[12px] text-ink-3">Topics</span>
            {reg.topics.map((t) => (
              <Tag key={t}>{topic(t)}</Tag>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            {focus && (
              <ButtonLink href={`/graph?node=${focus.node_id}`} size="sm" variant="secondary" icon={<Waypoints size={14} />}>
                View in graph
              </ButtonLink>
            )}
            <ButtonLink href={askHref} size="sm" variant="primary" icon={<MessageSquareText size={14} />}>
              Ask Copilot
            </ButtonLink>
          </div>
        </div>
      </header>

      {reg.lineage.items.length > 1 && (
        <Panel title="Lineage" meta="Amendments and supersessions, oldest first" className="mt-6">
          <div className="px-5 pb-5">
            <LineageTimeline lineage={reg.lineage} />
          </div>
        </Panel>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {reg.summary && (
            <Panel title="Summary">
              <p className="px-6 pb-6 text-[14px] leading-relaxed text-ink-2">{reg.summary}</p>
            </Panel>
          )}
          <Panel title="Requirements" meta={`${reg.requirements.length} extracted`}>
            {reg.requirements.length ? (
              <ol className="divide-y divide-line pb-2">
                {[...reg.requirements]
                  .sort((a, b) => a.ordinal - b.ordinal)
                  .map((r) => (
                    <RequirementRow key={r.id} req={r} impact={impactByReq.get(r.id)} />
                  ))}
              </ol>
            ) : (
              <EmptyState compact title="No requirements extracted">
                Obligraph didn&rsquo;t find binding requirements in this instrument.
              </EmptyState>
            )}
          </Panel>
        </div>

        <div className="space-y-6 lg:sticky lg:top-[92px]">
          <Panel title="Impact on us" meta={reg.org_impact.length ? `${reg.org_impact.length} obligations` : undefined}>
            <ImpactPanel reg={reg} />
          </Panel>
          {reg.lineage.items.length <= 1 && (
            <Panel title="Lineage">
              <p className="px-6 pb-6 text-[13px] text-ink-3">No amendments or supersessions recorded for this instrument.</p>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
