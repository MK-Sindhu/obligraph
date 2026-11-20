"use client";

import { ExternalLink, Play, Rss } from "lucide-react";
import { useState } from "react";
import { RegulatorTag } from "@/components/domain/badges";
import { Button } from "@/components/ui/button";
import { Panel, Toggle } from "@/components/ui/misc";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, type SourceOut } from "@/lib/api";
import { fmtDateTime, fmtNumber, relativeTime } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { StatusPill } from "./status";

export function SourcesPanel({ onQueued }: { onQueued: () => void }) {
  const toast = useToast();
  const sources = useQuery<SourceOut[]>("admin:sources", (signal) => api.admin.sources({ signal }));
  const [busy, setBusy] = useState<string | null>(null);
  const items = sources.data ?? [];

  async function toggle(s: SourceOut, enabled: boolean) {
    setBusy(s.key);
    sources.setData((prev) => (prev ?? []).map((x) => (x.key === s.key ? { ...x, enabled } : x)));
    try {
      const updated = await api.admin.toggleSource(s.key, enabled);
      sources.setData((prev) => (prev ?? []).map((x) => (x.key === s.key ? updated : x)));
      toast.success(`${s.name} ${enabled ? "enabled" : "disabled"}`, enabled ? "It will be crawled on the regular schedule." : undefined);
    } catch (err) {
      sources.setData((prev) => (prev ?? []).map((x) => (x.key === s.key ? s : x)));
      toast.error(`Couldn't ${enabled ? "enable" : "disable"} ${s.name}`, errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function run(s: SourceOut) {
    setBusy(s.key);
    try {
      await api.admin.runSource(s.key);
      toast.success("Crawl queued", `${s.name} will be fetched by the worker shortly.`);
      onQueued();
    } catch (err) {
      toast.error(`Couldn't queue ${s.name}`, errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel title="Regulator sources" meta={sources.data ? `${items.filter((s) => s.enabled).length} of ${items.length} enabled` : undefined}>
      {sources.loading && !sources.data && <LoadingRows rows={3} label="Loading sources" />}
      {sources.error != null && !sources.data && <ErrorState error={sources.error} onRetry={sources.reload} compact />}
      {sources.data && items.length === 0 && (
        <EmptyState icon={<Rss size={22} />} title="No sources configured" compact>
          Sources are the regulator feeds Obligraph crawls for new circulars. They are defined on the API.
        </EmptyState>
      )}
      {items.length > 0 && (
        <div className="overflow-x-auto px-3 pb-3">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] text-ink-3 [&>th]:font-medium">
                <th className="px-4 py-2">Source</th>
                <th className="px-3 py-2">Enabled</th>
                <th className="px-3 py-2">Last run</th>
                <th className="px-3 py-2 text-right">Items seen</th>
                <th className="px-4 py-2" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.key} className="border-t border-line align-top">
                  <td className="px-4 py-3">
                    <p className="flex items-center gap-2 font-medium">
                      <RegulatorTag regulator={s.regulator} />
                      {s.name}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-ink-3">{s.key}</p>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-0.5 inline-flex max-w-[320px] items-center gap-1 truncate rounded-full text-[12px] text-ink-2 hover:text-accent"
                    >
                      <span className="truncate">{s.url.replace(/^https?:\/\//, "")}</span>
                      <ExternalLink size={11} className="shrink-0" aria-hidden="true" />
                    </a>
                  </td>
                  <td className="px-3 py-3">
                    <Toggle
                      checked={s.enabled}
                      disabled={busy === s.key}
                      onChange={(v) => toggle(s, v)}
                      label={<span className="sr-only">{s.enabled ? `Disable ${s.name}` : `Enable ${s.name}`}</span>}
                    />
                  </td>
                  <td className="px-3 py-3">
                    {s.last_run_at ? (
                      <div className="space-y-1">
                        <p className="flex items-center gap-2 whitespace-nowrap text-ink-2" title={fmtDateTime(s.last_run_at)}>
                          {relativeTime(s.last_run_at)} <StatusPill status={s.last_status} />
                        </p>
                        {s.last_error && <p className="max-w-[260px] text-[12px] text-danger">{s.last_error}</p>}
                      </div>
                    ) : (
                      <span className="text-ink-3">Never run</span>
                    )}
                  </td>
                  <td className="num px-3 py-3 text-right text-ink-2">{fmtNumber(s.items_seen)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" icon={<Play size={12} />} loading={busy === s.key} onClick={() => run(s)}>
                      Run now
                    </Button>
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
