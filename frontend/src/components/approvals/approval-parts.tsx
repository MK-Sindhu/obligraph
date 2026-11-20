"use client";

import { CircleCheck, CircleSlash, Clock3, ShieldAlert, Undo2 } from "lucide-react";
import { useState } from "react";
import { EvidenceSection } from "@/components/evidence/evidence-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/field";
import { InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { api, type ApprovalOut, type ApprovalStatus, type TaskOut } from "@/lib/api";
import { humanize } from "@/lib/format";

export const APPROVAL_STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending: "Awaiting checker",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const APPROVAL_EVENT_LABEL: Record<string, string> = {
  submitted: "Submitted",
  escalated: "Escalated",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

/** Where the LangGraph thread is waiting, in plain words. */
export function workflowLabel(a: Pick<ApprovalOut, "status" | "workflow" | "level" | "required_role">): string {
  if (a.status !== "pending") return `Closed: ${APPROVAL_STATUS_LABEL[a.status].toLowerCase()}`;
  const next = a.workflow?.next?.[0];
  if (!next || next === "wait_for_checker")
    return `Waiting for ${a.required_role === "owner" ? "an owner" : `an ${a.required_role}`} to check`;
  return humanize(next.replace(/_/g, " "));
}

export function ApprovalStatusBadge({ status, overdue, size = "md" }: { status: ApprovalStatus; overdue?: boolean; size?: "sm" | "md" }) {
  if (status === "pending")
    return (
      <Badge size={size} tone={overdue ? "danger" : "accent"} icon={overdue ? <ShieldAlert size={12} /> : <Clock3 size={12} />}>
        {overdue ? "Overdue for a decision" : APPROVAL_STATUS_LABEL.pending}
      </Badge>
    );
  if (status === "approved")
    return (
      <Badge size={size} tone="ok" icon={<CircleCheck size={12} />}>
        Approved
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge size={size} tone="danger" icon={<CircleSlash size={12} />}>
        Rejected
      </Badge>
    );
  return (
    <Badge size={size} tone="dashed" icon={<Undo2 size={12} />}>
      Withdrawn
    </Badge>
  );
}

export function LevelBadge({ level, role }: { level: number; role: string }) {
  return (
    <Badge size="sm" tone={level >= 2 ? "danger" : level === 1 ? "warn" : "neutral"} title={`Needs the ${role} role to decide`}>
      Level {level} · {humanize(role)}
    </Badge>
  );
}

/**
 * "Submit for approval": the maker's note plus evidence to upload or select, then
 * POST /api/tasks/{id}/submit. The backend moves the task to review and opens the request.
 */
export function SubmitForApprovalDialog({
  task,
  onClose,
  onSubmitted,
}: {
  task: TaskOut | null;
  onClose: () => void;
  onSubmitted: (a: ApprovalOut) => void;
}) {
  if (!task) return null;
  return <SubmitInner key={task.id} task={task} onClose={onClose} onSubmitted={onSubmitted} />;
}

function SubmitInner({ task, onClose, onSubmitted }: { task: TaskOut; onClose: () => void; onSubmitted: (a: ApprovalOut) => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const a = await api.tasks.submit(task.id, { note: note.trim(), evidence_ids: selected });
      toast.success("Submitted for approval", "A checker has been notified. The task stays in review until they decide.");
      onSubmitted(a);
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
      title="Submit for approval"
      subtitle="This task needs a checker's sign-off before it can move to review or done."
      className="w-[min(620px,calc(100vw-24px))]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="submit-approval" variant="primary" loading={busy}>
            Submit for approval
          </Button>
        </>
      }
    >
      <form id="submit-approval" onSubmit={submit} className="space-y-5">
        <div className="rounded-[18px] bg-surface-2 px-4 py-3 shadow-inset-sm">
          <p className="text-[11.5px] font-medium text-ink-3">Task</p>
          <p className="mt-0.5 line-clamp-2 text-[13.5px] font-medium text-ink">{task.title}</p>
        </div>
        <div>
          <Label htmlFor="submit-note" hint="Optional">
            Note for the checker
          </Label>
          <Textarea
            id="submit-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What changed, where it's recorded, anything the checker should look at first."
          />
        </div>
        <div>
          <p className="mb-2 flex items-baseline justify-between text-[12.5px] font-medium text-ink-2">
            <span>Evidence</span>
            <span className="font-normal text-ink-3">{selected.length ? `${selected.length} attached` : "Select or upload"}</span>
          </p>
          <EvidenceSection
            link={{ task_id: task.id }}
            selection={{ selected, onChange: setSelected }}
            emptyText="No files on this task yet. Upload the policy extract, minutes or screenshot that shows the work is done."
          />
        </div>
        <InlineError error={error} />
      </form>
    </Dialog>
  );
}
