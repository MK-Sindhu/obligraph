"use client";

import { Inbox, Mail, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Chip } from "@/components/ui/badge";
import { IconButton, IconTile } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Panel } from "@/components/ui/misc";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage, type DemoRequestOut, type DemoRequestStatus } from "@/lib/api";
import { fmtDateTime, relativeTime } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { useVocab } from "@/lib/vocab";

const STATUSES: DemoRequestStatus[] = ["new", "contacted", "closed"];
const STATUS_LABEL: Record<DemoRequestStatus, string> = { new: "New", contacted: "Contacted", closed: "Closed" };

/** Requests from the public "Request a demo" form (platform admins only). */
export function DemoRequestsPanel() {
  const toast = useToast();
  const { entity } = useVocab();
  const q = useQuery<DemoRequestOut[]>("admin:demo-requests", (signal) => api.admin.demoRequests({ signal }));
  const [filter, setFilter] = useState<DemoRequestStatus | "">("new");
  const [busy, setBusy] = useState<string | null>(null);
  const items = q.data ?? [];
  const rows = [...items].filter((r) => !filter || r.status === filter).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const counts = STATUSES.reduce<Record<string, number>>((m, s) => ({ ...m, [s]: items.filter((r) => r.status === s).length }), {});
  const missing = q.error instanceof ApiError && q.error.status === 404;

  async function setStatus(r: DemoRequestOut, status: DemoRequestStatus) {
    setBusy(r.id);
    q.setData((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, status } : x)));
    try {
      const updated = await api.admin.updateDemoRequest(r.id, status);
      q.setData((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, ...updated } : x)));
      toast.success(`Marked ${STATUS_LABEL[status].toLowerCase()}`, `${r.name} · ${r.company}`);
    } catch (e) {
      q.setData((prev) => (prev ?? []).map((x) => (x.id === r.id ? r : x)));
      toast.error("Couldn't update the request", errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel
      title="Demo requests"
      meta={q.data ? `${counts.new ?? 0} new · ${items.length} in all` : undefined}
      icon={
        <IconTile tone="accent" size="sm">
          <Inbox size={15} />
        </IconTile>
      }
      actions={
        <IconButton label="Refresh demo requests" size="sm" onClick={q.reload} disabled={q.loading}>
          <RefreshCw size={14} className={q.loading && q.data ? "animate-spin" : undefined} />
        </IconButton>
      }
    >
      {q.data && (
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2 px-6 pb-3">
          <Chip active={!filter} onClick={() => setFilter("")} count={items.length}>
            All
          </Chip>
          {STATUSES.map((s) => (
            <Chip key={s} active={filter === s} onClick={() => setFilter(filter === s ? "" : s)} count={counts[s] ?? 0}>
              {STATUS_LABEL[s]}
            </Chip>
          ))}
        </div>
      )}
      {missing ? (
        <EmptyState compact icon={<Inbox size={22} />} title="Not available on this API yet">
          The demo request endpoints aren&rsquo;t live on this backend. Requests will show here once they are.
        </EmptyState>
      ) : q.error != null && !q.data ? (
        <ErrorState compact error={q.error} onRetry={q.reload} />
      ) : !q.data ? (
        <LoadingRows rows={3} label="Loading demo requests" />
      ) : rows.length === 0 ? (
        <EmptyState compact icon={<Inbox size={22} />} title={filter ? `No ${STATUS_LABEL[filter].toLowerCase()} requests` : "No demo requests yet"}>
          Requests from the &ldquo;Request a demo&rdquo; form on the public site appear here.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto px-3 pb-3">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] text-ink-3 [&>th]:font-medium">
                <th className="px-4 py-2">Received</th>
                <th className="px-3 py-2">From</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Message</th>
                <th className="w-[150px] px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-ink-2" title={fmtDateTime(r.created_at)}>
                    {relativeTime(r.created_at)}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-ink">{r.name}</p>
                    <a href={`mailto:${r.email}`} className="mt-0.5 inline-flex items-center gap-1 rounded-full text-[12.5px] text-accent hover:underline">
                      <Mail size={12} aria-hidden="true" /> {r.email}
                    </a>
                    {r.role && <p className="mt-0.5 text-[12px] text-ink-3">{r.role}</p>}
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-ink">{r.company}</p>
                    {r.entity_type && <p className="mt-0.5 text-[12px] text-ink-3">{r.entity_type === "other" ? "Other" : entity(r.entity_type)}</p>}
                  </td>
                  <td className="max-w-[340px] px-3 py-3 text-ink-2">
                    {r.message ? (
                      <details>
                        <summary className="line-clamp-2 cursor-pointer list-none">{r.message}</summary>
                        <p className="mt-1.5 whitespace-pre-line">{r.message}</p>
                      </details>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Select
                      aria-label={`Status of the request from ${r.name}`}
                      value={r.status}
                      disabled={busy === r.id}
                      onChange={(e) => setStatus(r, e.target.value as DemoRequestStatus)}
                      className="h-9 text-[13px]"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
