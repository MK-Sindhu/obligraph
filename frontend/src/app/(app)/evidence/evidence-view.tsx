"use client";

import clsx from "clsx";
import { Download, FileCheck2, FolderArchive, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EvidenceUploadButton, shortHash, useEvidenceDownload } from "@/components/evidence/evidence-list";
import { Badge, Chip } from "@/components/ui/badge";
import { IconButton, IconTile } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader, Panel, SearchField } from "@/components/ui/misc";
import { EmptyState, ErrorState, LoadingRows, Spinner } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage, type EvidenceOut, type FilingOut, type ObligationOut, type Page, type TaskOut } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtBytes, fmtDate, fmtDateTime } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { useUrlState } from "@/lib/url-state";

type Kind = "task" | "obligation" | "filing" | "none";

function kindOf(e: EvidenceOut): Kind {
  if (e.filing_id) return "filing";
  if (e.task_id) return "task";
  if (e.obligation_id) return "obligation";
  return "none";
}

const KIND_LABEL: Record<Kind, string> = { task: "Task", obligation: "Obligation", filing: "Filing", none: "Unlinked" };

export function EvidenceView() {
  const { can } = useAuth();
  const toast = useToast();
  const { get, set } = useUrlState();
  const kind = get("kind") as Kind | "";
  const q = get("q");

  const list = useQuery<EvidenceOut[]>("evidence:all", (signal) => api.evidence.list({ limit: 500 }, { signal }));
  // Names for the linked items.
  const tasks = useQuery<TaskOut[]>("tasks:all", (signal) => api.tasks.list({ limit: 500 }, { signal }));
  const obligations = useQuery<Page<ObligationOut>>("evidence:obligations", (signal) =>
    api.obligations.list({ limit: 200, include_retired: true }, { signal }),
  );
  const filings = useQuery<FilingOut[]>("filings:default", (signal) => api.filings.list({}, { signal }));
  const taskById = useMemo(() => new Map((tasks.data ?? []).map((t) => [t.id, t])), [tasks.data]);
  const obById = useMemo(() => new Map((obligations.data?.items ?? []).map((o) => [o.id, o])), [obligations.data]);
  const filingById = useMemo(() => new Map((filings.data ?? []).map((f) => [f.id, f])), [filings.data]);

  const { download, busy } = useEvidenceDownload();
  const [toDelete, setToDelete] = useState<EvidenceOut | null>(null);
  const [deleting, setDeleting] = useState(false);

  const all = list.data ?? [];
  const counts = all.reduce<Record<Kind, number>>((m, e) => ({ ...m, [kindOf(e)]: (m[kindOf(e)] ?? 0) + 1 }), { task: 0, obligation: 0, filing: 0, none: 0 });
  const needle = q.trim().toLowerCase();
  const rows = all.filter(
    (e) =>
      (!kind || kindOf(e) === kind) &&
      (!needle || e.filename.toLowerCase().includes(needle) || e.sha256.startsWith(needle) || (e.uploaded_by_name ?? "").toLowerCase().includes(needle)),
  );
  const totalBytes = all.reduce((n, e) => n + e.size_bytes, 0);

  function linked(e: EvidenceOut): { href: string; label: string } | null {
    if (e.filing_id) {
      const f = filingById.get(e.filing_id);
      return { href: `/filings?filing=${e.filing_id}`, label: f ? `${f.name} (${fmtDate(f.period_end)})` : "Filing" };
    }
    if (e.task_id) {
      const t = taskById.get(e.task_id);
      return { href: `/tasks?task=${e.task_id}`, label: t?.title ?? "Task" };
    }
    if (e.obligation_id) {
      const o = obById.get(e.obligation_id);
      return { href: `/obligations?id=${e.obligation_id}`, label: o?.requirement.text ?? "Obligation" };
    }
    return null;
  }

  async function remove() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.evidence.remove(toDelete.id);
      list.setData((prev) => (prev ?? []).filter((e) => e.id !== toDelete.id));
      toast.success("Evidence deleted", toDelete.filename);
      setToDelete(null);
    } catch (e) {
      toast.error(e instanceof ApiError && e.status === 409 ? "This file can't be deleted" : "Couldn't delete the file", errorMessage(e));
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Our compliance"
        title="Evidence"
        description="Every file attached to a task, obligation or filing, with who uploaded it and a SHA-256 fingerprint so you can show it hasn't changed."
        actions={can("member") && <EvidenceUploadButton link={{}} label="Upload unlinked file" onUploaded={(ev) => list.setData((prev) => [ev, ...(prev ?? [])])} />}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2.5">
        <SearchField
          label="Search evidence"
          value={q}
          onChange={(e) => set({ q: e.target.value || null })}
          placeholder="File name, uploader or hash prefix"
          className="min-w-[220px] flex-1 basis-full sm:max-w-sm sm:basis-auto"
        />
        <div role="group" aria-label="Filter by linked item" className="flex flex-wrap gap-2">
          <Chip active={!kind} onClick={() => set({ kind: null })} count={list.data ? all.length : undefined}>
            All
          </Chip>
          {(["task", "obligation", "filing", "none"] as const).map((k) => (
            <Chip key={k} active={kind === k} onClick={() => set({ kind: kind === k ? null : k })} count={list.data ? counts[k] : undefined}>
              {KIND_LABEL[k]}
              {k !== "none" && "s"}
            </Chip>
          ))}
        </div>
      </div>

      <Panel
        title="Evidence register"
        meta={list.data ? `${all.length} ${all.length === 1 ? "file" : "files"} · ${fmtBytes(totalBytes)}` : undefined}
        icon={
          <IconTile tone="accent" size="sm">
            <FolderArchive size={15} />
          </IconTile>
        }
      >
        {list.error != null && !list.data ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <LoadingRows rows={5} label="Loading evidence" />
        ) : rows.length === 0 ? (
          <EmptyState icon={<FileCheck2 size={22} />} title={all.length ? "No files match" : "No evidence yet"}>
            {all.length
              ? "Try another filter or search."
              : "Attach files from a task, an obligation or a filing. They are listed here with their SHA-256 fingerprint."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto px-3 pb-3">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead>
                <tr className="text-left text-[11.5px] text-ink-3 [&>th]:font-medium">
                  <th className="px-4 py-2">File</th>
                  <th className="px-3 py-2">Linked to</th>
                  <th className="px-3 py-2">Uploaded by</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">SHA-256</th>
                  <th className="w-24 px-3 py-2" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const l = linked(e);
                  const k = kindOf(e);
                  return (
                    <tr key={e.id} className="border-t border-line align-top transition-colors hover:bg-surface-2">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <IconTile tone="soft" size="sm">
                            <FileCheck2 size={15} />
                          </IconTile>
                          <div className="min-w-0">
                            <p className="max-w-[260px] truncate font-medium text-ink" title={e.filename}>
                              {e.filename}
                            </p>
                            <p className="text-[11.5px] text-ink-3">
                              {fmtBytes(e.size_bytes)} · {e.content_type || "file"}
                            </p>
                            {e.note && <p className="mt-0.5 line-clamp-1 max-w-[260px] text-[12px] text-ink-2">{e.note}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge size="sm" tone={k === "none" ? "dashed" : "neutral"}>
                          {KIND_LABEL[k]}
                        </Badge>
                        {l && (
                          <Link href={l.href} className="mt-1 line-clamp-2 max-w-[280px] text-[12.5px] text-ink hover:text-accent hover:underline" title={l.label}>
                            {l.label}
                          </Link>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-2">{e.uploaded_by_name ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-2" title={fmtDateTime(e.created_at)}>
                        {fmtDate(e.created_at)}
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-surface-2 px-2.5 py-[3px] font-mono text-[11px] text-ink-2 shadow-inset-sm" title={e.sha256}>
                          {shortHash(e.sha256, 12)}
                        </span>
                      </td>
                      <td className={clsx("whitespace-nowrap px-3 py-3 text-right")}>
                        <IconButton label={`Download ${e.filename}`} size="sm" onClick={() => download(e)} disabled={busy === e.id}>
                          {busy === e.id ? <Spinner size={13} /> : <Download size={15} />}
                        </IconButton>
                        {can("admin") && (
                          <IconButton label={`Delete ${e.filename}`} size="sm" className="hover:text-danger!" onClick={() => setToDelete(e)}>
                            <Trash2 size={15} />
                          </IconButton>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => !deleting && setToDelete(null)}
        onConfirm={remove}
        busy={deleting}
        title="Delete this evidence?"
        confirmLabel="Delete file"
      >
        <p>
          <span className="font-medium text-ink">{toDelete?.filename}</span> will be removed for everyone. Files that back an
          approved decision can&rsquo;t be deleted.
        </p>
      </ConfirmDialog>
    </>
  );
}
