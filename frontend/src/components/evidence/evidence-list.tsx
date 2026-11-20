"use client";

import clsx from "clsx";
import { Download, FileCheck2, Paperclip, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { IconButton, IconTile } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ErrorState, Spinner } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage, type EvidenceLink, type EvidenceOut } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { downloadFile } from "@/lib/download";
import { fmtBytes, fmtDateTime, relativeTime } from "@/lib/format";
import { useUploadLimitMb } from "@/lib/runtime";
import { useQuery } from "@/lib/use-query";


export function shortHash(sha: string, n = 10) {
  return sha.slice(0, n);
}

/** Download an evidence file with auth and confirm the content hash in a toast. */
export function useEvidenceDownload() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function download(ev: EvidenceOut) {
    setBusy(ev.id);
    try {
      const r = await downloadFile(api.evidence.downloadPath(ev.id), { filename: ev.filename });
      const ok = !r.sha256 || r.sha256 === ev.sha256;
      if (ok) toast.success("Downloaded", `${r.filename} · SHA-256 ${shortHash(r.sha256 ?? ev.sha256, 16)}`);
      else toast.error("Hash mismatch", `The downloaded file's SHA-256 doesn't match the recorded one for ${ev.filename}.`);
    } catch (e) {
      toast.error("Couldn't download the file", errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  return { download, busy };
}

/** One evidence file: icon, name, size · uploader · when, short hash, download / delete. */
export function EvidenceRow({
  ev,
  onDownload,
  downloading,
  onDelete,
  selectable,
  selected,
  onToggle,
  linked,
}: {
  ev: EvidenceOut;
  onDownload: () => void;
  downloading?: boolean;
  onDelete?: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  /** Optional linked-item line (Evidence page). */
  linked?: React.ReactNode;
}) {
  return (
    <li
      className={clsx(
        "flex items-center gap-3 rounded-[18px] px-3.5 py-2.5 transition-[background-color,box-shadow]",
        selected ? "bg-accent-wash ring-1 ring-accent/30" : "card-xs",
      )}
    >
      {selectable ? (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={onToggle}
          aria-label={`Attach ${ev.filename}`}
          className="h-4 w-4 shrink-0 accent-[var(--accent)]"
        />
      ) : null}
      <IconTile tone={selected ? "accent" : "soft"} size="sm">
        <FileCheck2 size={15} />
      </IconTile>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ink" title={ev.filename}>
          {ev.filename}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-ink-3">
          <span>{fmtBytes(ev.size_bytes)}</span>
          <span aria-hidden="true">·</span>
          <span>{ev.uploaded_by_name ?? "Someone"}</span>
          <span aria-hidden="true">·</span>
          <span title={fmtDateTime(ev.created_at)}>{relativeTime(ev.created_at)}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono text-[10.5px]" title={`SHA-256 ${ev.sha256}`}>
            {shortHash(ev.sha256)}
          </span>
        </p>
        {ev.note && <p className="mt-1 line-clamp-2 text-[12px] text-ink-2">{ev.note}</p>}
        {linked}
      </div>
      <IconButton label={`Download ${ev.filename}`} size="sm" onClick={onDownload} disabled={downloading}>
        {downloading ? <Spinner size={13} /> : <Download size={15} />}
      </IconButton>
      {onDelete && (
        <IconButton label={`Delete ${ev.filename}`} size="sm" className="hover:text-danger!" onClick={onDelete}>
          <Trash2 size={15} />
        </IconButton>
      )}
    </li>
  );
}

/** Attach-a-file control: a pill button around a hidden file input, with an upload spinner. */
export function EvidenceUploadButton({
  link,
  onUploaded,
  label = "Attach evidence",
  note,
}: {
  link: EvidenceLink;
  onUploaded: (ev: EvidenceOut) => void;
  label?: string;
  note?: string;
}) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const limitMb = useUploadLimitMb();
  const [busy, setBusy] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > limitMb * 1024 * 1024) {
      toast.error("File too large", `${file.name} is ${fmtBytes(file.size)}. The limit is ${limitMb} MB.`);
      return;
    }
    if (file.size === 0) {
      toast.error("Empty file", `${file.name} has no content.`);
      return;
    }
    setBusy(true);
    try {
      const ev = await api.evidence.upload(file, link, note);
      toast.success("Evidence attached", ev.filename);
      onUploaded(ev);
    } catch (e) {
      toast.error("Couldn't upload the file", errorMessage(e));
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <label
      className={clsx(
        "inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-line-strong/80 bg-surface px-3.5 text-[12.5px] font-medium text-ink shadow-xs transition-colors hover:text-accent",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
        busy && "pointer-events-none opacity-60",
      )}
    >
      <input ref={ref} type="file" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} disabled={busy} />
      {busy ? <Spinner size={12} /> : <Paperclip size={13} aria-hidden="true" />}
      {busy ? "Uploading…" : label}
    </label>
  );
}

/**
 * Evidence attached to a task, obligation or filing: list, upload (members), download,
 * delete (admins). With `selection`, rows get checkboxes (used when submitting for approval).
 */
export function EvidenceSection({
  link,
  selection,
  emptyText = "No evidence attached yet.",
  className,
}: {
  link: EvidenceLink;
  selection?: { selected: string[]; onChange: (ids: string[]) => void };
  emptyText?: string;
  className?: string;
}) {
  const { can } = useAuth();
  const toast = useToast();
  const limitMb = useUploadLimitMb();
  const key = `evidence:${link.task_id ?? ""}:${link.obligation_id ?? ""}:${link.filing_id ?? ""}`;
  const q = useQuery<EvidenceOut[]>(key, (signal) => api.evidence.list(link, { signal }));
  const { download, busy } = useEvidenceDownload();
  const [toDelete, setToDelete] = useState<EvidenceOut | null>(null);
  const [deleting, setDeleting] = useState(false);
  const items = q.data ?? [];

  async function remove() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.evidence.remove(toDelete.id);
      q.setData((prev) => (prev ?? []).filter((e) => e.id !== toDelete.id));
      if (selection) selection.onChange(selection.selected.filter((id) => id !== toDelete.id));
      toast.success("Evidence deleted", toDelete.filename);
      setToDelete(null);
    } catch (e) {
      const backs = e instanceof ApiError && e.status === 409;
      toast.error(backs ? "This file can't be deleted" : "Couldn't delete the file", errorMessage(e));
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={className}>
      {q.error != null && !q.data ? (
        <ErrorState compact error={q.error} onRetry={q.reload} />
      ) : !q.data ? (
        <p className="flex items-center gap-2 py-2 text-[13px] text-ink-3">
          <Spinner size={13} /> Loading evidence…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-[18px] border border-dashed border-line-strong px-4 py-3.5 text-[13px] text-ink-3">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((ev) => {
            const selected = selection?.selected.includes(ev.id);
            return (
              <EvidenceRow
                key={ev.id}
                ev={ev}
                onDownload={() => download(ev)}
                downloading={busy === ev.id}
                onDelete={can("admin") ? () => setToDelete(ev) : undefined}
                selectable={!!selection}
                selected={selected}
                onToggle={() =>
                  selection?.onChange(selected ? selection.selected.filter((id) => id !== ev.id) : [...selection.selected, ev.id])
                }
              />
            );
          })}
        </ul>
      )}
      {can("member") && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <EvidenceUploadButton
            link={link}
            onUploaded={(ev) => {
              q.setData((prev) => [ev, ...(prev ?? [])]);
              if (selection) selection.onChange([...selection.selected, ev.id]);
            }}
          />
          <span className="text-[11.5px] text-ink-3">Any file up to {limitMb} MB. Each file is hashed (SHA-256) on upload.</span>
        </div>
      )}
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
    </div>
  );
}
