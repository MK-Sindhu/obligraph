"use client";

import { FileText, RefreshCw, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { IconButton, IconTile } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader, Panel } from "@/components/ui/misc";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, type PolicyOut } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtChars, fmtDate, fmtNumber } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { PolicyUpload } from "./policy-upload";

function ReassessNotice({ title, onDismiss }: { title: string; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-3.5 rounded-[24px] border border-accent/20 bg-accent-wash px-5 py-4"
    >
      <IconTile tone="accent" size="sm">
        <RefreshCw size={15} />
      </IconTile>
      <div className="min-w-0 flex-1 text-[13.5px]">
        <p className="font-medium text-ink">&ldquo;{title}&rdquo; is uploaded. Obligations are being re-assessed against it.</p>
        <p className="mt-0.5 text-ink-2">
          Coverage, evidence quotes and suggested tasks update on{" "}
          <Link href="/obligations" className="font-medium text-accent hover:underline">
            Obligations
          </Link>{" "}
          within a minute or two, depending on how many obligations you have.
        </p>
      </div>
      <IconButton label="Dismiss notice" size="sm" onClick={onDismiss}>
        <X size={14} />
      </IconButton>
    </div>
  );
}

function PolicyTable({
  items,
  canDelete,
  onDelete,
}: {
  items: PolicyOut[];
  canDelete: boolean;
  onDelete: (p: PolicyOut) => void;
}) {
  return (
    <div className="overflow-x-auto px-3 pb-3">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11.5px] text-ink-3 [&>th]:font-medium">
            <th className="px-4 py-2">Policy</th>
            <th className="hidden px-3 py-2 sm:table-cell">Uploaded</th>
            <th className="hidden px-3 py-2 text-right sm:table-cell">Size</th>
            <th className="hidden px-3 py-2 text-right sm:table-cell">Passages</th>
            {canDelete && <th className="w-12 px-3 py-2" aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className="border-t border-line transition-colors hover:bg-surface-2">
              <td className="px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <IconTile tone="soft" size="sm">
                    <FileText size={15} />
                  </IconTile>
                  <div className="min-w-0">
                    <p className="font-medium leading-snug text-ink">{p.title}</p>
                    {p.filename && <p className="mt-0.5 truncate font-mono text-[11.5px] text-ink-3">{p.filename}</p>}
                    <p className="num mt-1 text-[12px] text-ink-2 sm:hidden">
                      {fmtDate(p.created_at)} · {fmtChars(p.chars)} · {fmtNumber(p.chunks)} {p.chunks === 1 ? "passage" : "passages"}
                    </p>
                  </div>
                </div>
              </td>
              <td className="hidden whitespace-nowrap px-3 py-3.5 text-ink-2 sm:table-cell">{fmtDate(p.created_at)}</td>
              <td className="num hidden whitespace-nowrap px-3 py-3.5 text-right text-ink-2 sm:table-cell">{fmtChars(p.chars)}</td>
              <td
                className="num hidden whitespace-nowrap px-3 py-3.5 text-right text-ink-2 sm:table-cell"
                title="Passages are the indexed sections Obligraph quotes as evidence"
              >
                {fmtNumber(p.chunks)}
              </td>
              {canDelete && (
                <td className="px-3 py-3.5 text-right">
                  <IconButton label={`Delete ${p.title}`} size="sm" className="hover:text-danger!" onClick={() => onDelete(p)}>
                    <Trash2 size={15} />
                  </IconButton>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PoliciesView() {
  const { can } = useAuth();
  const toast = useToast();
  const isAdmin = can("admin");
  const policies = useQuery<PolicyOut[]>("policies", (signal) => api.policies.list({ signal }));
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<PolicyOut | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.policies.remove(toDelete.id);
      policies.setData((prev) => (prev ?? []).filter((p) => p.id !== toDelete.id));
      toast.success("Policy deleted", "Obligations are being re-assessed without it.");
      setToDelete(null);
      policies.reload();
    } catch (e) {
      toast.error("Couldn't delete the policy", errorMessage(e));
    } finally {
      setDeleting(false);
    }
  }

  const items = policies.data ?? [];
  const totalChunks = items.reduce((n, p) => n + p.chunks, 0);

  return (
    <>
      <PageHeader
        eyebrow="Our compliance"
        title="Policies"
        description="Your board-approved policies. Obligraph reads them to judge whether each obligation is covered, and quotes them as evidence."
      />

      {uploaded && <ReassessNotice title={uploaded} onDismiss={() => setUploaded(null)} />}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          title="Uploaded policies"
          meta={
            policies.data
              ? `${items.length} ${items.length === 1 ? "document" : "documents"} · ${fmtNumber(totalChunks)} passages`
              : undefined
          }
          actions={
            <IconButton label="Refresh list" size="sm" onClick={policies.reload} disabled={policies.loading}>
              <RefreshCw size={14} className={policies.loading && policies.data ? "animate-spin" : undefined} />
            </IconButton>
          }
        >
          {policies.loading && !policies.data && <LoadingRows rows={3} label="Loading policies" />}
          {policies.error != null && !policies.data && <ErrorState error={policies.error} onRetry={policies.reload} />}
          {policies.data && items.length === 0 && (
            <EmptyState icon={<FileText size={26} />} title="No policies yet">
              Upload your board-approved policies so Obligraph can check coverage against every obligation that applies
              to you.
            </EmptyState>
          )}
          {items.length > 0 && <PolicyTable items={items} canDelete={isAdmin} onDelete={setToDelete} />}
        </Panel>

        <PolicyUpload
          canUpload={isAdmin}
          onUploaded={(p) => {
            setUploaded(p.title);
            policies.reload();
          }}
        />
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => !deleting && setToDelete(null)}
        onConfirm={confirmDelete}
        busy={deleting}
        title="Delete this policy?"
        confirmLabel="Delete policy"
      >
        <p>
          <span className="font-medium text-ink">{toDelete?.title}</span> will be removed and its passages will no longer
          count as evidence. Obligraph re-assesses your obligations afterwards, so some may move to partial or missing.
        </p>
      </ConfirmDialog>
    </>
  );
}
