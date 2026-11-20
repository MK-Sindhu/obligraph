"use client";

import clsx from "clsx";
import { ArrowRight, ArrowUpRight, Layers, ListChecks, Minus, Plus, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { COVERAGE_LABEL, CoverageBadge, ObligationStatusBadge, SeverityBadge, SeverityGlyph } from "@/components/domain/badges";
import { Badge, Chip } from "@/components/ui/badge";
import { Button, ButtonLink, IconButton, IconTile } from "@/components/ui/button";
import { softCardClass } from "@/components/ui/card";
import { DonutGauge } from "@/components/ui/charts";
import { PageHeader, Panel, SegmentedControl } from "@/components/ui/misc";
import { EmptyState, ErrorState, LoadingRows, Skeleton } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { api, type Coverage, type PackDetail, type PackSummary, type SbrLayer, type SbrOut, type SbrRequirement } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { humanize } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { useUrlState } from "@/lib/url-state";

const COV_ORDER: Coverage[] = ["covered", "partial", "missing", "unassessed"];
const LAYERS: SbrLayer[] = ["base", "middle", "upper", "top"];
const LAYER_LABEL: Record<SbrLayer, string> = { base: "Base", middle: "Middle", upper: "Upper", top: "Top" };

// ---------------------------------------------------------------- packs

function PackCard({ p, active, onOpen }: { p: PackSummary; active: boolean; onOpen: () => void }) {
  return (
    <article className={softCardClass("raised", "md", clsx("flex flex-col px-6 pb-6 pt-5", active && "ring-2 ring-accent/50"))}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="display text-[17px] leading-snug text-ink">{p.name}</h2>
          <p className="mt-0.5 text-[12px] text-ink-3">
            {p.obligations} obligation{p.obligations === 1 ? "" : "s"} · {p.regulations.length} instrument{p.regulations.length === 1 ? "" : "s"}
          </p>
        </div>
        <IconTile tone="accent" size="sm">
          <ShieldCheck size={15} />
        </IconTile>
      </div>
      <div className="mt-4 flex items-center gap-5">
        <DonutGauge
          value={p.readiness_pct}
          size={136}
          thickness={13}
          label={`${p.name}: ${p.readiness_pct === null ? "not assessed yet" : `${Math.round(p.readiness_pct)}% ready`}`}
          centerCaption={p.readiness_pct === null ? "not assessed" : "ready"}
          segments={COV_ORDER.map((k) => ({ key: k, value: p.by_coverage[k] ?? 0, color: `var(--cov-${k})`, label: COVERAGE_LABEL[k] }))}
        />
        <ul className="min-w-0 flex-1 space-y-1.5 text-[12.5px]">
          {COV_ORDER.filter((k) => (p.by_coverage[k] ?? 0) > 0 || k !== "unassessed").map((k) => (
            <li key={k} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: `var(--cov-${k})` }} aria-hidden="true" />
              <span className="flex-1 text-ink-2">{COVERAGE_LABEL[k]}</span>
              <span className="num font-medium text-ink">{p.by_coverage[k] ?? 0}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 line-clamp-3 text-[12.5px] leading-relaxed text-ink-2">{p.description}</p>
      <div className="mt-4">
        <p className="mb-2 text-[11.5px] font-medium text-ink-3">Top gaps</p>
        {p.top_gaps.length === 0 ? (
          <p className="rounded-[16px] bg-surface-2 px-3.5 py-2.5 text-[12.5px] text-ink-3 shadow-inset-sm">No open gaps in this pack.</p>
        ) : (
          <ul className="space-y-1.5">
            {p.top_gaps.slice(0, 3).map((g) => (
              <li key={g.obligation_id}>
                <Link
                  href={`/obligations?id=${g.obligation_id}`}
                  className="flex items-start gap-2.5 rounded-[16px] px-3 py-2 transition-colors hover:bg-surface-2"
                >
                  <SeverityGlyph severity={g.severity} className="mt-1" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[12.5px] leading-snug text-ink">{g.requirement}</span>
                    <span className="mt-1 block font-mono text-[10.5px] text-ink-3">{g.ref_no ?? g.regulation}</span>
                  </span>
                  <CoverageBadge coverage={g.coverage} className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-auto pt-5">
        <Button variant={active ? "primary" : "secondary"} size="sm" className="w-full" icon={<ListChecks size={14} />} onClick={onOpen} aria-pressed={active}>
          {active ? "Showing all items" : `All ${p.obligations} items`}
        </Button>
      </div>
    </article>
  );
}

function PackItems({ packKey, onClose }: { packKey: string; onClose: () => void }) {
  const { get, set } = useUrlState();
  const cov = get("cov") as Coverage | "";
  const q = useQuery<PackDetail>(`pack:${packKey}`, (signal) => api.packs.get(packKey, { signal }));
  const items = (q.data?.items ?? []).filter((i) => !cov || i.coverage === cov);
  return (
    <Panel
      title={q.data ? q.data.name : "Pack"}
      meta={q.data ? `${q.data.items.length} obligations` : undefined}
      className="mt-6"
      actions={
        <IconButton label="Close the list" size="sm" tone="soft" onClick={onClose}>
          <X size={15} />
        </IconButton>
      }
    >
      {q.error != null && !q.data ? (
        <ErrorState error={q.error} onRetry={q.reload} />
      ) : !q.data ? (
        <LoadingRows rows={5} label="Loading pack items" />
      ) : (
        <>
          <div role="group" aria-label="Filter by coverage" className="flex flex-wrap gap-2 px-6 pb-3">
            <Chip active={!cov} onClick={() => set({ cov: null })} count={q.data.items.length}>
              All
            </Chip>
            {COV_ORDER.map((k) => {
              const n = q.data!.items.filter((i) => i.coverage === k).length;
              return n ? (
                <Chip key={k} active={cov === k} onClick={() => set({ cov: cov === k ? null : k })} count={n}>
                  {COVERAGE_LABEL[k]}
                </Chip>
              ) : null;
            })}
          </div>
          <ul className="space-y-1 px-3 pb-4">
            {items.map((i) => (
              <li key={i.obligation_id}>
                <Link
                  href={`/obligations?id=${i.obligation_id}`}
                  className="grid gap-x-4 gap-y-2 rounded-[20px] px-4 py-3 transition-[background-color,box-shadow] hover:bg-surface-hi hover:shadow-raised-xs md:grid-cols-[92px_minmax(0,1fr)_auto]"
                >
                  <span className="pt-px">
                    <SeverityBadge severity={i.severity} />
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-[13px] leading-snug text-ink">{i.requirement}</span>
                    <span className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[11.5px] text-ink-3">
                      <span className="font-mono text-[10.5px] text-ink-2">{i.regulator}</span>
                      {i.ref_no && <span className="font-mono text-[10.5px]">{i.ref_no}</span>}
                      <span>· {humanize(i.kind)}</span>
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 md:justify-end">
                    <CoverageBadge coverage={i.coverage} />
                    <ObligationStatusBadge status={i.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function PacksTab() {
  const { get, set } = useUrlState();
  const packKey = get("pack");
  const q = useQuery<PackSummary[]>("packs", (signal) => api.packs.list({ signal }));
  if (q.error != null && !q.data) return <Panel><ErrorState error={q.error} onRetry={q.reload} /></Panel>;
  if (!q.data)
    return (
      <div className="grid gap-6 lg:grid-cols-3" role="status" aria-label="Loading packs">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[520px] rounded-card" />
        ))}
      </div>
    );
  if (!q.data.length)
    return (
      <Panel>
        <EmptyState icon={<ShieldCheck size={22} />} title="No readiness packs">
          Packs group obligations from one regime (DPDP, CERT-In, KYC/AML) so you can see how ready you are for it.
        </EmptyState>
      </Panel>
    );
  return (
    <>
      <div className="grid items-stretch gap-6 lg:grid-cols-3">
        {q.data.map((p) => (
          <PackCard key={p.key} p={p} active={packKey === p.key} onOpen={() => set({ pack: packKey === p.key ? null : p.key, cov: null })} />
        ))}
      </div>
      {packKey && <PackItems key={packKey} packKey={packKey} onClose={() => set({ pack: null, cov: null })} />}
    </>
  );
}

// ---------------------------------------------------------------- SBR

function LayerSteps({ sbr }: { sbr: SbrOut }) {
  const layers = sbr.layers ?? [];
  return (
    <ol className="grid grid-cols-2 items-end gap-4 sm:grid-cols-4" aria-label="Scale-based regulation layers, lowest first">
      {layers.map((l, i) => {
        const current = l.key === sbr.current_layer;
        const target = l.key === sbr.target_layer && !current;
        return (
          <li key={l.key} aria-current={current ? "step" : undefined}>
            <div
              className={clsx(
                "flex flex-col justify-end rounded-tile px-4 pb-4 pt-3 transition-shadow",
                current ? "soft ring-2 ring-accent/60" : target ? "border-2 border-dashed border-accent/60 bg-accent-wash/40" : "soft-inset",
              )}
              style={{ minHeight: 112 + i * 34 }}
            >
              <div className="mb-auto flex flex-wrap gap-1.5">
                {current && <Badge size="sm" tone="solid">Current</Badge>}
                {target && <Badge size="sm" tone="accent">Target</Badge>}
              </div>
              <p className={clsx("figure mt-3 text-[30px] leading-none", current ? "text-accent" : "text-ink")}>{l.requirements}</p>
              <p className="mt-1 text-[11.5px] text-ink-3">requirements</p>
              <p className={clsx("mt-2 text-[14px] font-medium", current ? "text-ink" : "text-ink-2")}>{l.label}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ReqList({ items, empty, tone }: { items: SbrRequirement[]; empty: string; tone: "add" | "relieve" | "all" }) {
  if (!items.length) return <p className="mx-6 mb-6 rounded-[18px] bg-surface-2 px-4 py-3 text-[13px] text-ink-3 shadow-inset-sm">{empty}</p>;
  return (
    <ul className="space-y-1 px-3 pb-4">
      {items.map((r) => (
        <li key={r.requirement_id}>
          <Link
            href={`/regulations/${r.regulation_id}`}
            className="flex items-start gap-3 rounded-[18px] px-3 py-2.5 transition-colors hover:bg-surface-2"
          >
            <span
              className={clsx(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px]",
                tone === "add" ? "bg-accent-grad-diag text-white shadow-glow-sm" : tone === "relieve" ? "bg-[var(--cov-covered-bg)] text-ok" : "bg-surface-2 text-ink-3 shadow-inset-sm",
              )}
              aria-hidden="true"
            >
              {tone === "add" ? <Plus size={14} /> : tone === "relieve" ? <Minus size={14} /> : <Layers size={13} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-[13px] leading-snug text-ink">{r.requirement}</span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-3">
                <span className="font-mono text-[10.5px]">{r.ref_no ?? r.regulation}</span>
                {tone === "all" && (
                  <>
                    <span className="sr-only">Applies at the {r.layers.map((l) => LAYER_LABEL[l]).join(", ")} layer{r.layers.length === 1 ? "" : "s"}.</span>
                    {LAYERS.map((l) => (
                      <span
                        key={l}
                        aria-hidden="true"
                        className={clsx(
                          "rounded-full px-1.5 py-px text-[10.5px] font-medium",
                          r.layers.includes(l) ? "bg-accent-wash text-accent" : "text-ink-3 line-through",
                        )}
                      >
                        {LAYER_LABEL[l]}
                      </span>
                    ))}
                  </>
                )}
              </span>
            </span>
            <SeverityBadge severity={r.severity} className="shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SbrTab() {
  const { can } = useAuth();
  const { get, set } = useUrlState();
  const targetParam = get("target") as SbrLayer | "";
  const q = useQuery<SbrOut>(`sbr:${targetParam}`, (signal) => api.sbr(targetParam || undefined, { signal }));
  const sbr = q.data;

  if (q.error != null && !sbr) return <Panel><ErrorState error={q.error} onRetry={q.reload} /></Panel>;
  if (!sbr) return <Skeleton className="h-[420px] rounded-card" />;
  if (!sbr.applicable)
    return (
      <Panel>
        <EmptyState icon={<Layers size={22} />} title="Scale-based regulation doesn't apply to you">
          RBI&rsquo;s scale-based framework sorts NBFCs into Base, Middle, Upper and Top layers, with stricter requirements higher up.
          Your organisation isn&rsquo;t registered as an NBFC, so there&rsquo;s nothing to show here. If that&rsquo;s wrong, update your entity
          types in Settings.
          {can("admin") && (
            <span className="mt-4 block">
              <ButtonLink href="/settings" size="sm" variant="secondary">
                Open settings
              </ButtonLink>
            </span>
          )}
        </EmptyState>
      </Panel>
    );

  const target = sbr.target_layer ?? "middle";
  const same = target === sbr.current_layer;
  return (
    <div className="space-y-6">
      <Panel
        title="Scale-based regulation layers"
        meta={sbr.current_layer ? `You're in the ${LAYER_LABEL[sbr.current_layer]} layer` : "Your layer isn't set"}
        icon={
          <IconTile tone="accent" size="sm">
            <Layers size={15} />
          </IconTile>
        }
      >
        <div className="px-6 pb-6">
          {!sbr.current_layer && (
            <p className="mb-4 rounded-[18px] border border-accent/20 bg-accent-wash px-4 py-3 text-[13px] text-ink-2">
              Set your SBR layer in{" "}
              <Link href="/settings" className="font-medium text-accent hover:underline">
                Settings → Organisation
              </Link>{" "}
              so obligations match the layer you&rsquo;re in.
            </p>
          )}
          <LayerSteps sbr={sbr} />
          <p className="mt-4 text-[12px] text-ink-3">Counts are in-force requirements that apply to an NBFC at each layer.</p>
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[13px] font-medium text-ink-2">Compare with</p>
        <SegmentedControl<SbrLayer>
          label="Target layer"
          value={target}
          onChange={(v) => set({ target: v })}
          options={LAYERS.map((l) => ({ value: l, label: LAYER_LABEL[l] }))}
        />
        {q.loading && <span className="text-[12px] text-ink-3">Updating…</span>}
      </div>

      {same ? (
        <Panel>
          <EmptyState compact icon={<ArrowRight size={20} />} title={`You're already in the ${LAYER_LABEL[target]} layer`}>
            Pick another layer above to see what moving there would add or relieve.
          </EmptyState>
        </Panel>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Panel title={`What moving to ${LAYER_LABEL[target]} adds`} meta={`${sbr.added_at_target?.length ?? 0} requirements`}>
            <ReqList items={sbr.added_at_target ?? []} tone="add" empty={`Nothing new: every ${LAYER_LABEL[target]} layer requirement already applies to you.`} />
          </Panel>
          <Panel title="What it relieves" meta={`${sbr.relieved_at_target?.length ?? 0} requirements`}>
            <ReqList items={sbr.relieved_at_target ?? []} tone="relieve" empty="Nothing you do today stops applying at that layer." />
          </Panel>
        </div>
      )}

      <Panel title="Layer-specific requirements" meta="Requirements that differ between layers">
        <ReqList items={sbr.layer_specific ?? []} tone="all" empty="No requirement in the corpus varies by layer." />
      </Panel>
    </div>
  );
}

export function ReadinessView() {
  const { get, set } = useUrlState();
  const tab = get("tab") === "sbr" ? "sbr" : "packs";
  return (
    <>
      <PageHeader
        eyebrow="Readiness"
        title="Readiness"
        description="How ready you are for a regime (DPDP, CERT-In, KYC/AML), and what changes if your NBFC moves up a scale-based regulation layer."
        actions={
          <ButtonLink href="/reports" variant="secondary" icon={<ArrowUpRight size={14} />}>
            Board pack
          </ButtonLink>
        }
      />
      <Tabs
        label="Readiness views"
        idPrefix="readiness"
        value={tab}
        onChange={(v) => set({ tab: v === "sbr" ? "sbr" : null, pack: null, cov: null, target: null })}
        tabs={[
          { value: "packs", label: "Readiness packs" },
          { value: "sbr", label: "SBR layers" },
        ]}
        className="mb-6"
      />
      <div role="tabpanel" id={`readiness-panel-${tab}`} aria-labelledby={`readiness-tab-${tab}`}>
        {tab === "packs" ? <PacksTab /> : <SbrTab />}
      </div>
    </>
  );
}
