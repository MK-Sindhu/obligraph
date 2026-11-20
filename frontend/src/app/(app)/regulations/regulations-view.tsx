"use client";

import { ArrowUpRight, Check, ScrollText, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RegStatusBadge } from "@/components/domain/badges";
import { Docket } from "@/components/domain/docket";
import { Button } from "@/components/ui/button";
import { FilterSelect, PageHeader, Pagination, Panel, SearchField, Tag, Toggle } from "@/components/ui/misc";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { api, type Page, type RegulationSummary } from "@/lib/api";
import { useQuery } from "@/lib/use-query";
import { useUrlState } from "@/lib/url-state";
import { useVocab } from "@/lib/vocab";

const LIMIT = 15;

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  const [prev, setPrev] = useState(value);
  // The URL changed from outside (e.g. "Clear filters"): adopt it.
  if (value !== prev) {
    setPrev(value);
    setText(value);
  }
  // Debounce typing into the URL.
  useEffect(() => {
    if (text === value) return;
    const id = window.setTimeout(() => onChange(text), 300);
    return () => window.clearTimeout(id);
  }, [text, value, onChange]);
  return (
    <SearchField
      label="Search regulations"
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder="Search title, reference or summary"
      className="min-w-0 flex-1 basis-full sm:max-w-sm sm:basis-auto"
    />
  );
}

function RegulationRow({ r }: { r: RegulationSummary }) {
  const { topic } = useVocab();
  return (
    <li>
      <Link
        href={`/regulations/${r.id}`}
        className="group grid gap-x-6 gap-y-2 rounded-[22px] px-4 py-4 transition-[background-color,box-shadow] hover:bg-surface-hi hover:shadow-raised-xs md:grid-cols-[minmax(0,1fr)_auto]"
      >
        <div className="min-w-0">
          <Docket regulator={r.regulator} refNo={r.ref_no} date={r.issued_on} docType={r.doc_type} />
          <p className="display mt-1.5 text-[16px] leading-snug text-ink group-hover:text-accent">{r.title}</p>
          {r.summary && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-2">{r.summary}</p>}
          {r.topics.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {r.topics.map((t) => (
                <Tag key={t}>{topic(t)}</Tag>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-row flex-wrap items-center gap-x-3 gap-y-1.5 md:flex-col md:items-end md:justify-start">
          <RegStatusBadge status={r.status} />
          <span className="num text-[12px] text-ink-3">
            {r.requirement_count ?? 0} requirement{r.requirement_count === 1 ? "" : "s"}
          </span>
          {r.applies_to_org && (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-ok">
              <Check size={13} aria-hidden="true" /> Applies to you
            </span>
          )}
          <ArrowUpRight size={16} className="hidden text-ink-4 transition-colors group-hover:text-accent md:block" aria-hidden="true" />
        </div>
      </Link>
    </li>
  );
}

export function RegulationsView() {
  const { get, set } = useUrlState();
  const { vocab } = useVocab();
  const q = get("q");
  const regulator = get("regulator");
  const topic = get("topic");
  const status = get("status");
  const applies = get("applies") === "1";
  const offset = Math.max(0, Number(get("offset")) || 0);

  const filters = { q, regulator, topic, status, applies, limit: LIMIT, offset };
  const key = JSON.stringify(filters);
  const list = useQuery<Page<RegulationSummary>>(`regs:${key}`, (signal) => api.regulations.list(filters, { signal }));
  const filtered = !!(q || regulator || topic || status || applies);
  const page = list.data;

  return (
    <>
      <PageHeader
        eyebrow="Regulatory corpus"
        title="Regulations"
        description="Circulars, master directions and notifications Obligraph has read, with the requirements extracted from each."
      />
      <div className="mb-6 flex flex-wrap items-center gap-2.5">
        <SearchBox value={q} onChange={(v) => set({ q: v, offset: null })} />
        <FilterSelect
          label="Regulator"
          value={regulator}
          onChange={(v) => set({ regulator: v, offset: null })}
          options={(vocab?.regulators ?? []).map((r) => ({ value: r.key, label: r.key }))}
        />
        <FilterSelect
          label="Topic"
          value={topic}
          onChange={(v) => set({ topic: v, offset: null })}
          options={(vocab?.topics ?? []).map((t) => ({ value: t.key, label: t.label }))}
          className="max-w-[240px]"
        />
        <FilterSelect
          label="Status"
          value={status}
          onChange={(v) => set({ status: v, offset: null })}
          options={[
            { value: "in_force", label: "In force" },
            { value: "superseded", label: "Superseded" },
          ]}
        />
        <span className="px-1.5">
          <Toggle checked={applies} onChange={(v) => set({ applies: v ? "1" : null, offset: null })} label="Applies to us" />
        </span>
        {filtered && (
          <Button
            size="sm"
            variant="ghost"
            icon={<X size={13} />}
            onClick={() => set({ q: null, regulator: null, topic: null, status: null, applies: null, offset: null })}
          >
            Clear filters
          </Button>
        )}
      </div>

      <Panel
        title={page ? `${page.total} regulation${page.total === 1 ? "" : "s"}` : "Regulations"}
        meta={applies ? "Only instruments that create obligations for you" : undefined}
      >
        {list.error && !page ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : !page ? (
          <LoadingRows rows={6} />
        ) : page.items.length === 0 ? (
          filtered ? (
            <EmptyState icon={<Search size={22} />} title="No regulations match these filters">
              Try a broader search, or clear the filters to see the whole corpus.
            </EmptyState>
          ) : (
            <EmptyState icon={<ScrollText size={22} />} title="No regulations in the corpus yet">
              Platform admins can ingest circulars from Platform admin, or enable regulator feeds.
            </EmptyState>
          )
        ) : (
          <div className={list.loading ? "opacity-60 transition-opacity" : undefined}>
            <ul className="space-y-1 px-3">
              {page.items.map((r) => (
                <RegulationRow key={r.id} r={r} />
              ))}
            </ul>
            <Pagination total={page.total} limit={page.limit} offset={page.offset} onChange={(o) => set({ offset: o || null })} noun="regulations" />
          </div>
        )}
      </Panel>
    </>
  );
}
