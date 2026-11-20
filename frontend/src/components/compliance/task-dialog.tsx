"use client";

import { Link2, Lock, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SubmitForApprovalDialog } from "@/components/approvals/approval-parts";
import { AiTag, CoverageBadge, SeverityGlyph } from "@/components/domain/badges";
import { EvidenceSection } from "@/components/evidence/evidence-list";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/misc";
import { InlineError, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { api, type ObligationOut, type TaskOut, type TaskPriority, type TaskStatus, type TaskUpdate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDateTime, humanize, label, TASK_STATUS_LABEL } from "@/lib/format";
import { useMembers } from "@/lib/members";
import { useQuery } from "@/lib/use-query";
import { PRIORITIES, TASK_COLUMNS, taskTitleFor } from "./utils";

export interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  /** Edit this task; omit to create a new one. */
  task?: TaskOut | null;
  /** Link a new task to this obligation. */
  obligationId?: string | null;
  /** Pre-filled title for a new task (defaults to one derived from the obligation). */
  defaultTitle?: string;
  onSaved?: (task: TaskOut, mode: "created" | "updated") => void;
  onDeleted?: (taskId: string) => void;
}

/** Create / edit dialog for a remediation task. Mounts fresh each time it opens. */
export function TaskDialog(props: TaskDialogProps) {
  if (!props.open) return null;
  return <TaskDialogInner key={props.task?.id ?? `new:${props.obligationId ?? ""}`} {...props} />;
}

function LinkedObligation({ obligationId, onLoaded }: { obligationId: string; onLoaded?: (ob: ObligationOut) => void }) {
  const q = useQuery<ObligationOut>(`task-ob:${obligationId}`, async (signal) => {
    const ob = await api.obligations.get(obligationId, { signal });
    onLoaded?.(ob);
    return ob;
  });
  return (
    <div className="rounded-[20px] bg-surface-2 px-4 py-3 shadow-inset-sm">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-ink-3">
        <Link2 size={11} aria-hidden="true" /> Linked obligation
      </p>
      {!q.data && !q.error && <Skeleton className="h-4 w-full" />}
      {q.error != null && !q.data && <p className="text-[12.5px] text-ink-3">The linked obligation couldn&rsquo;t be loaded.</p>}
      {q.data && (
        <div className="space-y-1.5">
          <p className="flex items-start gap-2 text-[13px] leading-snug">
            <SeverityGlyph severity={q.data.requirement.severity} className="mt-1" />
            <span className="line-clamp-3">{q.data.requirement.text}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <CoverageBadge coverage={q.data.coverage} />
            <span className="truncate font-mono text-[10.5px] uppercase tracking-[0.04em] text-ink-3">
              {q.data.regulation.regulator} · {q.data.regulation.ref_no ?? q.data.regulation.title}
            </span>
            <Link href={`/obligations?id=${q.data.id}`} className="ml-auto text-[12px] font-medium text-accent hover:underline">
              Open obligation
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskDialogInner({ onClose, task, obligationId, defaultTitle, onSaved, onDeleted }: TaskDialogProps) {
  const toast = useToast();
  const { can } = useAuth();
  const { members } = useMembers();
  const editing = !!task;
  const readOnly = !can("member");
  const linkedId = task?.obligation_id ?? obligationId ?? null;

  const [title, setTitle] = useState(task?.title ?? defaultTitle ?? "");
  const [titleTouched, setTitleTouched] = useState(!!(task || defaultTitle));
  const [detail, setDetail] = useState(task?.detail ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [dueOn, setDueOn] = useState(task?.due_on ?? "");
  const [assignee, setAssignee] = useState(task?.assignee_id ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const locked = !!task?.approval_id;
  const needsApproval = !!task?.requires_approval && !locked;

  // For a new task raised from an obligation, suggest a title once the obligation loads.
  const onObligationLoaded = (ob: ObligationOut) => {
    if (!editing && !titleTouched) {
      setTitle((t) => t || taskTitleFor(ob));
      if (ob.requirement.due_on) setDueOn((d) => d || ob.requirement.due_on || "");
    }
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError(new Error("Give the task a title."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (task) {
        // Send only what changed: any PATCH marks an AI-suggested task as edited.
        const diff: TaskUpdate = {};
        if (cleanTitle !== task.title) diff.title = cleanTitle;
        if (detail !== task.detail) diff.detail = detail;
        if (priority !== task.priority) diff.priority = priority;
        if ((dueOn || null) !== task.due_on) diff.due_on = dueOn || null;
        if ((assignee || null) !== task.assignee_id) diff.assignee_id = assignee || null;
        if (status !== task.status) {
          if (needsApproval && (status === "review" || status === "done")) {
            setBusy(false);
            setSubmitting(true);
            return;
          }
          diff.status = status;
        }
        if (Object.keys(diff).length === 0) {
          onClose();
          return;
        }
        const saved = await api.tasks.update(task.id, diff);
        toast.success("Task saved");
        onSaved?.(saved, "updated");
      } else {
        const saved = await api.tasks.create({
          title: cleanTitle,
          detail,
          priority,
          due_on: dueOn || null,
          assignee_id: assignee || null,
          obligation_id: linkedId,
        });
        toast.success("Task created");
        onSaved?.(saved, "created");
      }
      onClose();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  async function remove() {
    if (!task) return;
    setDeleting(true);
    try {
      await api.tasks.remove(task.id);
      toast.success("Task deleted");
      setConfirmDelete(false);
      onDeleted?.(task.id);
      onClose();
    } catch (err) {
      setDeleting(false);
      setConfirmDelete(false);
      setError(err);
    }
  }

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={editing ? (readOnly ? "Task" : "Edit task") : "New task"}
        subtitle={
          task ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <AiTag source={task.source} />
              <span>Created {fmtDateTime(task.created_at)}</span>
              {task.completed_at && <span>· Done {fmtDateTime(task.completed_at)}</span>}
            </span>
          ) : linkedId ? (
            "Track the remediation work for this obligation."
          ) : (
            "Track a piece of compliance work for your team."
          )
        }
        footer={
          <>
            {editing && !readOnly && (
              <Button
                variant="quiet-danger"
                className="mr-auto"
                icon={<Trash2 size={14} aria-hidden="true" />}
                onClick={() => setConfirmDelete(true)}
              >
                Delete task
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {editing && needsApproval && !readOnly && task?.status !== "done" && (
              <Button variant="secondary" icon={<ShieldCheck size={14} aria-hidden="true" />} onClick={() => setSubmitting(true)}>
                Submit for approval
              </Button>
            )}
            {!readOnly && (
              <Button type="submit" form="task-form" variant="primary" loading={busy}>
                {editing ? "Save task" : "Create task"}
              </Button>
            )}
          </>
        }
      >
        <form id="task-form" onSubmit={submit} className="space-y-4">
          {linkedId && <LinkedObligation obligationId={linkedId} onLoaded={onObligationLoaded} />}
          {locked && task && (
            <p className="flex items-start gap-2.5 rounded-[18px] border border-accent/20 bg-accent-wash px-4 py-3 text-[13px] text-ink-2">
              <Lock size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              <span>
                Submitted for approval. The status is locked until a checker decides.{" "}
                <Link href={`/approvals?id=${task.approval_id}`} className="font-medium text-accent hover:underline">
                  Open the approval
                </Link>
              </span>
            </p>
          )}
          <div>
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              required
              disabled={readOnly}
              value={title}
              maxLength={300}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleTouched(true);
              }}
              placeholder="e.g. Update incident response SOP to 6-hour reporting"
            />
          </div>
          <div>
            <Label htmlFor="task-detail" hint="Optional">
              Details
            </Label>
            <Textarea
              id="task-detail"
              rows={4}
              disabled={readOnly}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="What needs to change, who signs off, what evidence to keep."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="task-priority">Priority</Label>
              <Select
                id="task-priority"
                disabled={readOnly}
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {humanize(p)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="task-due" hint="Optional">
                Due date
              </Label>
              <Input id="task-due" type="date" disabled={readOnly} value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="task-assignee">Assignee</Label>
              <Select id="task-assignee" disabled={readOnly} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name}
                  </option>
                ))}
              </Select>
            </div>
            {editing && (
              <div>
                <Label htmlFor="task-status">Status</Label>
                <Select
                  id="task-status"
                  disabled={readOnly || locked}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                >
                  {TASK_COLUMNS.map((s) => (
                    <option key={s} value={s}>
                      {label(TASK_STATUS_LABEL, s)}
                      {needsApproval && (s === "review" || s === "done") && s !== task?.status ? " (needs approval)" : ""}
                    </option>
                  ))}
                </Select>
                {needsApproval && (
                  <p className="mt-1.5 text-[11.5px] text-ink-3">Review and done go through a maker-checker approval.</p>
                )}
              </div>
            )}
          </div>
          {!editing && <p className="text-[12px] text-ink-3">New tasks start in To do.</p>}
          {editing && task && (
            <div>
              <p className="mb-2 text-[12.5px] font-medium text-ink-2">Evidence</p>
              <EvidenceSection link={{ task_id: task.id }} emptyText="No evidence on this task yet." />
            </div>
          )}
          <InlineError error={error} />
        </form>
      </Dialog>
      <SubmitForApprovalDialog
        task={submitting && task ? task : null}
        onClose={() => setSubmitting(false)}
        onSubmitted={(a) => {
          if (task) onSaved?.({ ...task, status: "review", approval_id: a.id }, "updated");
          onClose();
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        busy={deleting}
        title="Delete this task?"
        confirmLabel="Delete task"
      >
        &ldquo;{task?.title}&rdquo; will be removed for everyone in your organisation. This can&rsquo;t be undone.
      </ConfirmDialog>
    </>
  );
}
