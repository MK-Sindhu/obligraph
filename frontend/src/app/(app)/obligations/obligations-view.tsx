"use client";

import clsx from "clsx";
import { FilterX, ListChecks, RotateCw, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ObligationDrawer } from "@/components/compliance/obligation-drawer";
import { compareObligations, OBLIGATION_STATUSES } from "@/components/compliance/utils";
import { COVERAGE_LABEL, CoverageBadge, ObligationStatusBadge, SEVERITIES, SeverityBadge } from "@/components/domain/badges";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Avatar, FilterSelect, PageHeader, Pagination, Panel, SearchField } from "@/components/ui/misc";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, type ObligationFilters, type ObligationOut, type Page } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { humanize, label, OBLIGATION_STATUS_LABEL } from "@/lib/format";
import { useMembers } from "@/lib/members";
import { useQuery } from "@/lib/use-query";
import { useUrlState } from "@/lib/url-state";
import { useVocab } from "@/lib/vocab";

const PAGE_SIZE = 25;
/** Upper bound the API allows per request; used when filtering or merging client-side. */
const CLIENT_LIMIT = 200;

type ListData =
  | { mode: "server"; page: Page<ObligationOut> }
  | { mode: "client"; all: ObligationOut[]; truncated: boolean };

const COVERAGE_OPTIONS = [
  { value: "gaps", label: "Open gaps" },
  ...(["covered", "partial", "missing", "unassessed"] as const).map((c) => ({ value: c, label: COVERAGE_LABEL[c] })),
];

function mapItems(data: ListData, fn: (o: ObligationOut) => ObligationOut): ListData {
  return data.mode === "server"
    ? { ...data, page: { ...data.page, items: data.page.items.map(fn) } }
    : { ...data, all: data.all.map(fn) };
}

function OwnerCell({ ownerId }: { ownerId: string | null }) {
  const { byId } = useMembers();
  const owner = ownerId ? byId.get(ownerId) : undefined;
  if (!owner) return <span className="text-[12.5px] text-ink-3">Unassigned</span>;
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-ink-2">
      <Avatar name={owner.user.name} size={20} />
      <span className="truncate">{owner.user.name}</span>
    </span>
  );
}

function RegLine({ ob }: { ob: ObligationOut }) {
  const r = ob.regulation;
  return (
    <p className="mt-1 flex min-w-0 items-baseline gap-1.5 text-[11.5px] text-ink-3" title={`${r.regulator} · ${r.ref_no ?? ""} · ${r.title}`}>
      <span className="shrink-0 font-mono text-[10.5px] font-medium tracking-[0.05em] text-ink-2">{r.regulator}</span>
      {r.ref_no && <span className="shrink-0 font-mono text-[10.5px] tracking-[0.03em]">{r.ref_no}</span>}
      <span className="truncate">{r.title}</span>
    </p>
  );
}

function TasksCount({ n }: { n: number }) {
  return n > 0 ? (
    <span className="num text-[12.5px] text-ink-2" title={`${n} open task${n === 1 ? "" : "s"}`}>
      {n}
    </span>
  ) : (
    <span className="text-[12.5px] text-ink-3" title="No open tasks">
      —
    </span>
  );
}

function ObligationRow({ ob, href, selected }: { ob: ObligationOut; href: string; selected: boolean }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={clsx(
        "relative mx-3 block rounded-[20px] px-4 py-3.5 transition-[background-color,box-shadow] hover:bg-surface-hi hover:shadow-raised-xs focus-visible:outline-offset-[-2px]",
        selected && "bg-accent-wash! shadow-none! ring-1 ring-accent/30",
      )}
    >
      {selected && <span className="absolute inset-y-3 left-0 w-[4px] rounded-full bg-accent-grad-diag" aria-hidden="true" />}
      {/* Desktop: one row per obligation */}
      <div className="hidden items-start gap-x-4 md:grid md:grid-cols-[92px_minmax(0,1fr)_124px_104px_140px_40px]">
        <div className="pt-px">
          <SeverityBadge severity={ob.requirement.severity} />
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 text-[13.5px] leading-snug text-ink">{ob.requirement.text}</p>
          <RegLine ob={ob} />
        </div>
        <div className="pt-px">
          <CoverageBadge coverage={ob.coverage} confidence={ob.confidence} />
        </div>
        <div className="pt-px">
          <ObligationStatusBadge status={ob.status} />
        </div>
        <div className="min-w-0 pt-px">
          <OwnerCell ownerId={ob.owner_id} />
        </div>
        <div className="pt-px text-right">
          <TasksCount n={ob.open_tasks} />
        </div>
      </div>
      {/* Narrow screens: stacked card */}
      <div className="md:hidden">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <SeverityBadge severity={ob.requirement.severity} />
          <CoverageBadge coverage={ob.coverage} confidence={ob.confidence} />
          <ObligationStatusBadge status={ob.status} />
        </div>
        <p className="line-clamp-3 text-[13.5px] leading-snug text-ink">{ob.requirement.text}</p>
        <RegLine ob={ob} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <OwnerCell ownerId={ob.owner_id} />
          {ob.open_tasks > 0 && (
            <span className="num text-[12px] text-ink-3">
              {ob.open_tasks} open task{ob.open_tasks === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ObligationsView() {
  const { org, can } = useAuth();
  const vocab = useVocab();
  const toast = useToast();
  const { params, get, set } = useUrlState();

  const coverage = get("coverage");
  const severity = get("severity");
  const regulator = get("regulator");
  const topic = get("topic");
  const status = get("status");
  const q = get("q");
  const id = get("id");
  const offset = Math.max(0, Number(get("offset")) || 0);
  // The dashboard heatmap groups by a requirement's first topic; "general" = no topic.
  const primary = !!topic && (get("primary") === "1" || topic === "general");
  const clientMode = coverage === "gaps" || primary;

  const [qInput, setQInput] = useState(q);
  const debounce = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(debounce.current), []);

  const [confirmAll, setConfirmAll] = useState(false);
  const [assessingAll, setAssessingAll] = useState(false);

  const key = JSON.stringify({ coverage, severity, regulator, topic, status, q, primary, offset: clientMode ? 0 : offset });
  const list = useQuery<ListData>(`obligations:${key}`, async (signal) => {
    const base: ObligationFilters = {
      severity: severity || undefined,
      regulator: regulator || undefined,
      topic: topic && topic !== "general" ? topic : undefined,
      status: status || undefined,
      q: q || undefined,
      include_retired: status === "not_applicable" ? true : undefined,
    };
    if (!clientMode) {
      const page = await api.obligations.list({ ...base, coverage: coverage || undefined, limit: PAGE_SIZE, offset }, { signal });
      return { mode: "server", page };
    }
    const coverages = coverage === "gaps" ? ["missing", "partial"] : [coverage || undefined];
    const pages = await Promise.all(
      coverages.map((c) => api.obligations.list({ ...base, coverage: c, limit: CLIENT_LIMIT, offset: 0 }, { signal })),
    );
    let all = pages.flatMap((p) => p.items);
    if (primary) {
      all = all.filter((o) => (topic === "general" ? o.requirement.topics.length === 0 : o.requirement.topics[0] === topic));
    }
    all.sort(compareObligations);
    return { mode: "client", all, truncated: pages.some((p) => p.total > p.items.length) };
  });

  const data = list.data;
  const rows = !data ? [] : data.mode === "server" ? data.page.items : data.all.slice(offset, offset + PAGE_SIZE);
  const total = !data ? 0 : data.mode === "server" ? data.page.total : data.all.length;
  const filtered = !!(coverage || severity || regulator || topic || status || q);

  function setFilter(patch: Record<string, string | null>) {
    set({ ...patch, offset: null });
  }

  function clearFilters() {
    window.clearTimeout(debounce.current);
    setQInput("");
    set({ coverage: null, severity: null, regulator: null, topic: null, status: null, q: null, primary: null, offset: null });
  }

  function onSearch(v: string) {
    setQInput(v);
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => set({ q: v.trim() || null, offset: null }), 300);
  }

  function hrefFor(obId: string) {
    const p = new URLSearchParams(params.toString());
    p.set("id", obId);
    return `/obligations?${p.toString()}`;
  }

  async function assessAll() {
    setAssessingAll(true);
    try {
      await api.obligations.assessAll();
      setConfirmAll(false);
      toast.toast({
        title: "Re-assessment queued",
        body: "Every obligation is being checked against your policies again. Coverage updates here as each one finishes.",
      });
      window.setTimeout(() => list.reload(), 6000);
    } catch (e) {
      toast.error("Couldn't queue the re-assessment", errorMessage(e));
    } finally {
      setAssessingAll(false);
    }
  }

  const topicOptions = (vocab.vocab?.topics ?? []).map((t) => ({ value: t.key, label: t.label }));
  if (topic === "general") topicOptions.unshift({ value: "general", label: "General (no topic)" });
  if (topic && !topicOptions.some((t) => t.value === topic)) topicOptions.unshift({ value: topic, label: vocab.topic(topic) });

  return (
    <div>
      <PageHeader
        eyebrow={org?.name}
        title="Obligations"
        description="Every requirement that applies to you, with how well your policies cover it and who owns closing the gap."
        actions={
          can("admin") && (
            <Button variant="secondary" icon={<RotateCw size={14} aria-hidden="true" />} onClick={() => setConfirmAll(true)}>
              Re-assess all
            </Button>
          )
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2.5">
        <SearchField
          label="Search obligations"
          value={qInput}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search requirement or regulation title"
          className="min-w-[200px] flex-1 basis-full sm:basis-auto"
        />
        <FilterSelect
          label="Coverage"
          value={coverage}
          onChange={(v) => setFilter({ coverage: v })}
          options={COVERAGE_OPTIONS}
          className="w-[calc(50%-4px)] sm:w-auto"
        />
        <FilterSelect
          label="Severity"
          value={severity}
          onChange={(v) => setFilter({ severity: v })}
          options={SEVERITIES.map((s) => ({ value: s, label: humanize(s) }))}
          className="w-[calc(50%-4px)] sm:w-auto"
        />
        <FilterSelect
          label="Regulator"
          value={regulator}
          onChange={(v) => setFilter({ regulator: v })}
          options={(vocab.vocab?.regulators ?? []).map((r) => ({ value: r.key, label: r.key }))}
          className="w-[calc(50%-4px)] sm:w-auto"
        />
        <FilterSelect
          label="Topic"
          value={topic}
          onChange={(v) => setFilter({ topic: v, primary: null })}
          options={topicOptions}
          className="w-[calc(50%-4px)] sm:w-auto sm:max-w-[210px]"
        />
        <FilterSelect
          label="Status"
          value={status}
          onChange={(v) => setFilter({ status: v })}
          options={OBLIGATION_STATUSES.map((s) => ({ value: s, label: label(OBLIGATION_STATUS_LABEL, s) }))}
          className="w-[calc(50%-4px)] sm:w-auto"
        />
        {filtered && (
          <Button variant="ghost" size="sm" icon={<FilterX size={13} aria-hidden="true" />} onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {primary && (
        <div className="-mt-3 mb-6 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-wash py-1 pl-3 pr-1 font-medium text-accent">
            Primary topic only: {topic === "general" ? "requirements without a topic" : vocab.topic(topic)}
            <button
              type="button"
              aria-label="Include requirements where this is a secondary topic"
              title="Include requirements where this is a secondary topic"
              onClick={() => setFilter({ primary: null, topic: topic === "general" ? null : topic })}
              className="rounded-full p-0.5 hover:bg-accent/15"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
          <span className="text-ink-3">Matches the dashboard heatmap, which groups each requirement under its first topic.</span>
        </div>
      )}

      <Panel
        title="Register"
        meta={data ? `${total} obligation${total === 1 ? "" : "s"}${list.loading ? " · updating…" : ""}` : undefined}
      >
        <div
          className="mx-3 mb-2 hidden grid-cols-[92px_minmax(0,1fr)_124px_104px_140px_40px] gap-x-4 rounded-full bg-surface-2 px-4 py-2 shadow-inset-sm md:grid"
          aria-hidden="true"
        >
          {["Severity", "Requirement", "Coverage", "Status", "Owner", "Tasks"].map((h, i) => (
            <span key={h} className={clsx("text-[11.5px] font-medium text-ink-3", i === 5 && "text-right")}>
              {h}
            </span>
          ))}
        </div>

        {!data && list.error == null && <LoadingRows rows={8} label="Loading obligations" />}
        {list.error != null && !data && <ErrorState error={list.error} onRetry={list.reload} />}
        {list.error != null && data && (
          <p role="alert" className="mx-6 mb-2 rounded-[14px] bg-danger-bg px-4 py-2 text-[12.5px] text-danger">
            Couldn&rsquo;t refresh: {errorMessage(list.error)}{" "}
            <button type="button" className="font-medium underline" onClick={list.reload}>
              Try again
            </button>
          </p>
        )}

        {data && rows.length === 0 && (
          filtered ? (
            <EmptyState
              icon={<FilterX size={22} />}
              title="No obligations match these filters"
              action={
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            >
              Try a broader coverage or severity, or clear the search.
            </EmptyState>
          ) : (
            <EmptyState icon={<ListChecks size={22} />} title="No obligations yet">
              Obligations appear when a regulation that applies to your entity types is ingested.{" "}
              <Link href="/settings" className="font-medium text-accent hover:underline">
                Check your entity types
              </Link>
              .
            </EmptyState>
          )
        )}

        {rows.length > 0 && (
          <div className={clsx("space-y-1", list.loading && "opacity-60 transition-opacity")}>
            {rows.map((ob) => (
              <ObligationRow key={ob.id} ob={ob} href={hrefFor(ob.id)} selected={ob.id === id} />
            ))}
          </div>
        )}

        {data?.mode === "client" && data.truncated && (
          <p className="px-6 pt-3 text-[12px] text-ink-3">
            Showing the first {CLIENT_LIMIT} matches per coverage level. Narrow the filters to see the rest.
          </p>
        )}
        {data && (
          <Pagination
            total={total}
            limit={PAGE_SIZE}
            offset={offset}
            noun="obligations"
            onChange={(o) => set({ offset: o || null })}
          />
        )}
      </Panel>

      <ObligationDrawer
        id={id || null}
        onClose={() => set({ id: null })}
        onUpdated={(updated) => {
          if (list.data) list.setData((prev) => mapItems(prev as ListData, (o) => (o.id === updated.id ? updated : o)));
        }}
      />

      <Dialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        title="Re-assess every obligation?"
        className="w-[min(460px,calc(100vw-24px))]"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmAll(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={assessingAll} onClick={assessAll}>
              Re-assess all
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-ink-2">
          Obligraph checks each of {org?.name ?? "your organisation"}&rsquo;s obligations against your current policies again.
          Suggested tasks nobody has touched are replaced with fresh suggestions; tasks you have edited or moved are kept.
        </p>
      </Dialog>
    </div>
  );
}
