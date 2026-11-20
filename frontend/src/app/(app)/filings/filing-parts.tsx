"use client";

import { Ban, CheckCircle2, Clock3, FileCheck2, RotateCcw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { EvidenceSection, EvidenceUploadButton } from "@/components/evidence/evidence-list";
import { RegulatorTag } from "@/components/domain/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Meta } from "@/components/ui/misc";
import { Toggle } from "@/components/ui/toggle";
import { InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  api,
  type EvidenceOut,
  type FilingOut,
  type FilingStatus,
  type ReturnFrequency,
  type ReturnTypeIn,
  type ReturnTypeOut,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDate, parseDate, todayISO } from "@/lib/format";
import { useVocab } from "@/lib/vocab";

export const FILING_STATUS_LABEL: Record<FilingStatus, string> = {
  pending: "Pending",
  overdue: "Overdue",
  filed: "Filed",
  late: "Filed late",
  waived: "Waived",
};

export const FREQ_LABEL: Record<ReturnFrequency, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  annual: "Annual",
};

export function FilingStatusChip({ status, size = "md" }: { status: FilingStatus; size?: "sm" | "md" }) {
  switch (status) {
    case "filed":
      return (
        <Badge size={size} tone="ok" icon={<CheckCircle2 size={12} />}>
          Filed
        </Badge>
      );
    case "late":
      return (
        <Badge size={size} tone="warn" icon={<Clock3 size={12} />}>
          Filed late
        </Badge>
      );
    case "overdue":
      return (
        <Badge size={size} tone="danger" icon={<TriangleAlert size={12} />}>
          Overdue
        </Badge>
      );
    case "waived":
      return (
        <Badge size={size} tone="dashed" icon={<Ban size={12} />}>
          Waived
        </Badge>
      );
    default:
      return (
        <Badge size={size} tone="accent" icon={<Clock3 size={12} />}>
          Pending
        </Badge>
      );
  }
}

const monthYear = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" });
const monthOnly = new Intl.DateTimeFormat("en-IN", { month: "short" });

/** "Oct 2026", "Jul–Sep 2026", "Apr 2025–Mar 2026". */
export function periodLabel(f: Pick<FilingOut, "period_start" | "period_end" | "frequency">): string {
  const s = parseDate(f.period_start);
  const e = parseDate(f.period_end);
  if (f.frequency === "monthly" || (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear())) return monthYear.format(s);
  if (s.getFullYear() === e.getFullYear()) return `${monthOnly.format(s)}–${monthYear.format(e)}`;
  return `${monthYear.format(s)}–${monthYear.format(e)}`;
}

export function SampleBadge({ title }: { title?: string }) {
  return (
    <Badge size="sm" tone="warn" title={title ?? "Sample entry: verify against current directions"}>
      Sample
    </Badge>
  );
}

export type FilingMode = "details" | "file" | "waive";

/** Details, "Mark as filed" (with acknowledgement evidence) and "Waive" for one filing. */
export function FilingDialog({
  filing,
  mode,
  onClose,
  onChange,
  onMode,
}: {
  filing: FilingOut | null;
  mode: FilingMode;
  onClose: () => void;
  onChange: (f: FilingOut) => void;
  onMode: (m: FilingMode) => void;
}) {
  if (!filing) return null;
  return <FilingDialogInner key={`${filing.id}:${mode}`} filing={filing} mode={mode} onClose={onClose} onChange={onChange} onMode={onMode} />;
}

function FilingDialogInner({
  filing,
  mode,
  onClose,
  onChange,
  onMode,
}: {
  filing: FilingOut;
  mode: FilingMode;
  onClose: () => void;
  onChange: (f: FilingOut) => void;
  onMode: (m: FilingMode) => void;
}) {
  const { can } = useAuth();
  const toast = useToast();
  const [filedOn, setFiledOn] = useState(todayISO());
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [ack, setAck] = useState<EvidenceOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const open = filing.status === "pending" || filing.status === "overdue";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let updated: FilingOut;
      if (mode === "file") {
        updated = await api.filings.file(filing.id, { filed_on: filedOn, reference: reference.trim(), note: note.trim(), evidence_id: ack?.id ?? null });
        toast.success(updated.status === "late" ? "Recorded as filed late" : "Marked as filed", `${filing.name} · ${periodLabel(filing)}`);
      } else {
        updated = await api.filings.waive(filing.id, note.trim());
        toast.success("Filing waived", `${filing.name} · ${periodLabel(filing)}`);
      }
      onChange(updated);
      onClose();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  async function reopen() {
    setBusy(true);
    try {
      const updated = await api.filings.reopen(filing.id);
      toast.success("Filing reopened", "It's back in the pending list.");
      onChange(updated);
      onClose();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  const header = (
    <div className="flex flex-wrap items-center gap-2">
      <RegulatorTag regulator={filing.regulator} />
      <span className="font-mono text-[11px] text-ink-3">{filing.code}</span>
      <FilingStatusChip status={filing.status} size="sm" />
      {filing.sample && <SampleBadge />}
    </div>
  );

  const facts = (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 [&>div]:rounded-[16px] [&>div]:bg-surface-2 [&>div]:px-3.5 [&>div]:py-2.5 [&>div]:">
      <Meta label="Period">{periodLabel(filing)}</Meta>
      <Meta label="Due">{fmtDate(filing.due_on)}</Meta>
      <Meta label="Filed">{filing.filed_on ? fmtDate(filing.filed_on) : "—"}</Meta>
      <Meta label="Reference">{filing.reference ? <span className="font-mono text-[12px]">{filing.reference}</span> : "—"}</Meta>
    </dl>
  );

  if (mode === "details") {
    return (
      <Dialog
        open
        onClose={onClose}
        title={filing.name}
        subtitle={header}
        className="w-[min(640px,calc(100vw-24px))]"
        footer={
          <>
            {can("admin") && !open && (
              <Button variant="ghost" icon={<RotateCcw size={14} />} loading={busy} onClick={reopen} className="mr-auto">
                Reopen
              </Button>
            )}
            {can("admin") && open && (
              <Button variant="ghost" icon={<Ban size={14} />} onClick={() => onMode("waive")} className="mr-auto">
                Waive
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {can("member") && open && (
              <Button variant="primary" icon={<FileCheck2 size={14} />} onClick={() => onMode("file")}>
                Mark as filed
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-5">
          {facts}
          {filing.note && (
            <p className="rounded-[18px] px-4 py-3 text-[13px] text-ink-2 card-xs">
              <span className="block text-[11.5px] font-medium text-ink-3">Note</span>
              {filing.note}
            </p>
          )}
          <div>
            <p className="mb-2 text-[12.5px] font-medium text-ink-2">Acknowledgements and evidence</p>
            <EvidenceSection link={{ filing_id: filing.id }} emptyText="No acknowledgement attached yet." />
          </div>
          <InlineError error={error} />
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={mode === "file" ? "Mark as filed" : "Waive this filing"}
      subtitle={
        <>
          {filing.name} · {periodLabel(filing)} · due {fmtDate(filing.due_on)}
        </>
      }
      className="w-[min(600px,calc(100vw-24px))]"
      footer={
        <>
          <Button variant="ghost" onClick={() => onMode("details")}>
            Back
          </Button>
          <Button type="submit" form="filing-form" variant={mode === "file" ? "primary" : "danger"} loading={busy}>
            {mode === "file" ? "Record filing" : "Waive filing"}
          </Button>
        </>
      }
    >
      <form id="filing-form" onSubmit={submit} className="space-y-4">
        {mode === "file" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
              <div>
                <Label htmlFor="filed-on">Filed on</Label>
                <Input id="filed-on" type="date" required max={todayISO()} value={filedOn} onChange={(e) => setFiledOn(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="filed-ref">Acknowledgement / reference no.</Label>
                <Input id="filed-ref" required value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. ACK-202611-118" />
              </div>
            </div>
            {filedOn > filing.due_on && (
              <p className="flex items-center gap-2 rounded-[14px] bg-[var(--sev-medium-bg)] px-3.5 py-2.5 text-[12.5px] text-warn">
                <Clock3 size={14} aria-hidden="true" /> After the due date: this will be recorded as filed late.
              </p>
            )}
            <div>
              <Label htmlFor="filed-note" hint="Optional">
                Note
              </Label>
              <Textarea id="filed-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Who filed it, on which portal, anything unusual." />
            </div>
            <div>
              <p className="mb-2 text-[12.5px] font-medium text-ink-2">Acknowledgement</p>
              {ack ? (
                <p className="flex items-center gap-2.5 rounded-[16px] bg-accent-wash px-3.5 py-2.5 text-[13px]">
                  <FileCheck2 size={15} className="text-accent" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{ack.filename}</span>
                  <button type="button" className="rounded-full text-[12px] font-medium text-accent hover:underline" onClick={() => setAck(null)}>
                    Remove
                  </button>
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <EvidenceUploadButton link={{ filing_id: filing.id }} label="Attach acknowledgement" onUploaded={setAck} note="Filing acknowledgement" />
                  <span className="text-[11.5px] text-ink-3">The portal receipt or acknowledgement PDF. Optional, but auditors will ask.</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div>
            <Label htmlFor="waive-note">Why is it waived?</Label>
            <Textarea
              id="waive-note"
              rows={3}
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Not applicable this period: no transactions above the threshold."
            />
            <p className="mt-1.5 text-[12px] text-ink-3">Waivers are recorded in the activity log and the board pack.</p>
          </div>
        )}
        <InlineError error={error} />
      </form>
    </Dialog>
  );
}

/** Add a custom return (admin) or edit one (custom returns only). */
export function ReturnDialog({
  open,
  existing,
  onClose,
  onSaved,
}: {
  open: boolean;
  existing: ReturnTypeOut | null;
  onClose: () => void;
  onSaved: (r: ReturnTypeOut) => void;
}) {
  if (!open) return null;
  return <ReturnDialogInner key={existing?.id ?? "new"} existing={existing} onClose={onClose} onSaved={onSaved} />;
}

function ReturnDialogInner({ existing, onClose, onSaved }: { existing: ReturnTypeOut | null; onClose: () => void; onSaved: (r: ReturnTypeOut) => void }) {
  const toast = useToast();
  const { vocab } = useVocab();
  const [f, setF] = useState<ReturnTypeIn & { active: boolean }>({
    code: existing?.code ?? "",
    name: existing?.name ?? "",
    regulator: existing?.regulator ?? "",
    frequency: existing?.frequency ?? "quarterly",
    due_days: existing?.due_days ?? 15,
    description: existing?.description ?? "",
    portal: existing?.portal ?? "",
    active: existing?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const saved = existing
        ? await api.returns.update(existing.id, {
            name: f.name.trim(),
            frequency: f.frequency,
            due_days: f.due_days,
            description: f.description,
            portal: f.portal || null,
            active: f.active,
          })
        : await api.returns.create({
            code: f.code.trim(),
            name: f.name.trim(),
            regulator: f.regulator,
            frequency: f.frequency,
            due_days: f.due_days,
            description: f.description,
            portal: f.portal || null,
          });
      toast.success(existing ? "Return updated" : "Return added", saved.name);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? "Edit return" : "Add a custom return"}
      subtitle={existing ? `${existing.code} · ${existing.regulator}` : "A periodic filing your organisation tracks. Obligraph schedules a filing for each period."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="return-form" variant="primary" loading={busy}>
            {existing ? "Save return" : "Add return"}
          </Button>
        </>
      }
    >
      <form id="return-form" onSubmit={submit} className="space-y-4">
        {!existing && (
          <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
            <div>
              <Label htmlFor="ret-code">Code</Label>
              <Input id="ret-code" required maxLength={40} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="e.g. NBFC-ALM" />
            </div>
            <div>
              <Label htmlFor="ret-reg">Regulator</Label>
              <Select id="ret-reg" required value={f.regulator} onChange={(e) => setF({ ...f, regulator: e.target.value })}>
                <option value="" disabled>
                  Choose a regulator
                </option>
                {(vocab?.regulators ?? []).map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.key} — {r.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}
        <div>
          <Label htmlFor="ret-name">Name</Label>
          <Input id="ret-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Quarterly ALM return" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ret-freq">Frequency</Label>
            <Select id="ret-freq" value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value as ReturnFrequency })}>
              {(Object.keys(FREQ_LABEL) as ReturnFrequency[]).map((k) => (
                <option key={k} value={k}>
                  {FREQ_LABEL[k]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ret-due" hint="After period end">
              Due within (days)
            </Label>
            <Input
              id="ret-due"
              type="number"
              min={0}
              max={365}
              required
              value={f.due_days}
              onChange={(e) => setF({ ...f, due_days: Number(e.target.value) })}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="ret-portal" hint="Optional">
            Filing portal
          </Label>
          <Input id="ret-portal" type="url" value={f.portal ?? ""} onChange={(e) => setF({ ...f, portal: e.target.value })} placeholder="https://…" />
        </div>
        <div>
          <Label htmlFor="ret-desc" hint="Optional">
            Description
          </Label>
          <Textarea id="ret-desc" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What it covers and which direction requires it." />
        </div>
        {existing && <Toggle checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Active (schedule new filings)" />}
        <InlineError error={error} />
      </form>
    </Dialog>
  );
}
