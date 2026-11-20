"use client";

import { CalendarSearch } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RegStatusBadge, RegulatorTag } from "@/components/domain/badges";
import { FilterSelect, Label } from "@/components/ui/misc";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { api, type InForceRow } from "@/lib/api";
import { fmtDate, todayISO } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { useVocab } from "@/lib/vocab";

/** "Which instruments were in force on this date?" via the graph's lineage edges. */
export function InForceTool() {
  const { vocab } = useVocab();
  const [on, setOn] = useState(() => todayISO());
  const [topic, setTopic] = useState("");
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(on);
  const q = useQuery<InForceRow[]>(valid ? `inforce:${on}:${topic}` : null, (signal) =>
    api.graph.inForce(on, topic || undefined, { signal }),
  );
  const rows = q.data ?? [];

  return (
    <div className="px-6 pb-6 pt-3">
      <p className="mb-1 text-[12px] text-ink-3">Point-in-time view</p>
      <h2 className="display text-[17px] leading-snug">What was in force on a date</h2>
      <p className="mt-1 text-[12.5px] text-ink-2">
        Instruments issued on or before the date that had not yet been superseded.
      </p>
      <div className="mt-3 grid gap-2">
        <div>
          <Label htmlFor="inforce-on">Date</Label>
          <input
            id="inforce-on"
            type="date"
            className="field h-9 text-[13px]"
            value={on}
            max="2100-12-31"
            onChange={(e) => setOn(e.target.value)}
          />
        </div>
        <FilterSelect
          label="Topic"
          value={topic}
          onChange={setTopic}
          allLabel="All topics"
          options={(vocab?.topics ?? []).map((t) => ({ value: t.key, label: t.label }))}
        />
      </div>

      <div className="mt-5">
        {!valid && <p className="text-[12.5px] text-ink-3">Enter a full date to see what applied.</p>}
        {valid && q.loading && !q.data && <LoadingRows rows={3} className="p-0!" label="Loading instruments in force" />}
        {valid && q.error != null && <ErrorState compact error={q.error} onRetry={q.reload} />}
        {valid && q.settled && !q.error && rows.length === 0 && (
          <EmptyState compact icon={<CalendarSearch size={20} />} title="Nothing in force on that date">
            No ingested instrument {topic ? "on this topic " : ""}had been issued by {fmtDate(on)}.
          </EmptyState>
        )}
        {valid && rows.length > 0 && !q.error && (
          <>
            <p className="mb-2 text-[12px] text-ink-3">
              <span className="num">{rows.length}</span> instrument{rows.length === 1 ? "" : "s"} on {fmtDate(on)}
            </p>
            <ul className={q.loading ? "space-y-2 opacity-60" : "space-y-2"}>
              {rows.map((r) => (
                <li key={r.regulation_id} className="rounded-[18px] card-xs px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <RegulatorTag regulator={r.regulator} />
                    {r.ref_no && <span className="truncate font-mono text-[10.5px] text-ink-2">{r.ref_no}</span>}
                  </div>
                  <Link
                    href={`/regulations/${r.regulation_id}`}
                    className="mt-1.5 block text-[13px] font-medium leading-snug text-ink hover:text-accent hover:underline"
                  >
                    {r.title}
                  </Link>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11.5px] text-ink-3">Issued {fmtDate(r.issued_on)}</span>
                    <span className="flex items-center gap-1 text-[11px] text-ink-3">
                      Today <RegStatusBadge status={r.status_today} />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
