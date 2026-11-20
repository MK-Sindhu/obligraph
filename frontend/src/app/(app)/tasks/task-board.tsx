"use client";

import clsx from "clsx";
import { ArrowLeft, ArrowRight, CalendarClock, GripVertical, Lock, Plus, ShieldCheck, SquareKanban } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { SubmitForApprovalDialog } from "@/components/approvals/approval-parts";
import { TaskDialog } from "@/components/compliance/task-dialog";
import { TASK_COLUMNS } from "@/components/compliance/utils";
import { AiTag, PriorityBadge, SeverityGlyph } from "@/components/domain/badges";
import { CountBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Avatar, FilterSelect, PageHeader, Panel } from "@/components/ui/misc";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage, type MemberOut, type ObligationOut, type TaskOut, type TaskStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { daysUntil, dueLabel, fmtShortDate, label, TASK_STATUS_LABEL } from "@/lib/format";
import { useMembers } from "@/lib/members";
import { useQuery } from "@/lib/use-query";
import { useUrlState } from "@/lib/url-state";

const DRAG_TYPE = "application/x-obligraph-task";

const COLUMN_HINT: Record<TaskStatus, string> = {
  todo: "Not started",
  doing: "Being worked on",
  review: "Awaiting sign-off",
  done: "Closed",
};

function DueLine({ task }: { task: TaskOut }) {
  if (!task.due_on) return null;
  const n = daysUntil(task.due_on);
  const open = task.status !== "done";
  const overdue = open && n < 0;
  const soon = open && n >= 0 && n <= 7;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 text-[12px]",
        overdue ? "font-medium text-danger" : soon ? "text-ink-2" : "text-ink-3",
      )}
      title={open ? dueLabel(task.due_on) : undefined}
    >
      <CalendarClock size={12} aria-hidden="true" />
      <span className="num">{fmtShortDate(task.due_on)}</span>
      {(overdue || soon) && <span>· {dueLabel(task.due_on).replace(/^Due /, "").toLowerCase()}</span>}
    </span>
  );
}

function TaskCard({
  task,
  obligation,
  assignee,
  editable,
  onOpen,
  onMove,
  dragging,
  onDragState,
}: {
  task: TaskOut;
  obligation: ObligationOut | undefined;
  assignee: MemberOut | undefined;
  editable: boolean;
  onOpen: () => void;
  onMove: (status: TaskStatus) => void;
  dragging: boolean;
  onDragState: (id: string | null) => void;
}) {
  const col = TASK_COLUMNS.indexOf(task.status);
  const prev = TASK_COLUMNS[col - 1];
  const next = TASK_COLUMNS[col + 1];
  // A pending approval locks the task's status until the checker decides.
  const locked = !!task.approval_id;
  const movable = editable && !locked;
  return (
    <article
      draggable={movable}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, task.id);
        e.dataTransfer.setData("text/plain", task.title);
        e.dataTransfer.effectAllowed = "move";
        onDragState(task.id);
      }}
      onDragEnd={() => onDragState(null)}
      className={clsx(
        "group rounded-[20px] soft-sm p-4 transition-[opacity,box-shadow,transform]",
        movable && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-45",
        "hover:-translate-y-px hover:shadow-raised",
      )}
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        <AiTag source={task.source} />
        <span className="flex-1" />
        {assignee ? (
          <Avatar name={assignee.user.name} size={24} />
        ) : (
          <span className="min-w-0 truncate text-[11px] text-ink-3" title="Unassigned">
            Unassigned
          </span>
        )}
        {movable && <GripVertical size={14} className="-mr-1 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />}
      </div>
      <button
        type="button"
        onClick={onOpen}
        className={clsx(
          "block w-full rounded-[8px] text-left text-[13px] font-medium leading-snug text-ink hover:text-accent",
          task.status === "done" && "text-ink-2 line-through decoration-ink-3",
        )}
      >
        <span className="line-clamp-3">{task.title}</span>
      </button>
      {task.obligation_id && (
        <Link
          href={`/obligations?id=${task.obligation_id}`}
          className="mt-2 flex min-w-0 items-center gap-1.5 rounded-full text-[11.5px] text-ink-3 hover:text-accent"
          title={obligation?.requirement.text ?? "Open the linked obligation"}
          draggable={false}
        >
          {obligation && <SeverityGlyph severity={obligation.requirement.severity} />}
          <span className="truncate font-mono text-[10.5px] tracking-[0.03em]">
            {obligation ? `${obligation.regulation.regulator} · ${obligation.regulation.ref_no ?? obligation.regulation.title}` : "Linked obligation"}
          </span>
        </Link>
      )}
      {(locked || (task.requires_approval && task.status !== "done")) && (
        <div className="mt-2.5">
          {locked ? (
            <Link
              href={`/approvals?id=${task.approval_id}`}
              draggable={false}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-wash px-2.5 py-[4px] text-[11.5px] font-medium text-accent hover:underline"
              title="Status is locked until the checker decides"
            >
              <Lock size={11} aria-hidden="true" /> Awaiting approval
            </Link>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-[3px] text-[11px] font-medium text-ink-2"
              title="Moving this task to review or done needs a checker's approval"
            >
              <ShieldCheck size={11} className="text-accent" aria-hidden="true" /> Needs sign-off
            </span>
          )}
        </div>
      )}
      <div className="mt-3 flex min-h-8 items-center gap-1 border-t border-line pt-2">
        <DueLine task={task} />
        <span className="flex-1" />
        {movable && (
          <>
            {prev && (
              <IconButton size="sm" label={`Move to ${label(TASK_STATUS_LABEL, prev)}`} onClick={() => onMove(prev)}>
                <ArrowLeft size={14} />
              </IconButton>
            )}
            {next && (
              <IconButton size="sm" label={`Move to ${label(TASK_STATUS_LABEL, next)}`} onClick={() => onMove(next)}>
                <ArrowRight size={14} />
              </IconButton>
            )}
          </>
        )}
      </div>
    </article>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading tasks">
      {TASK_COLUMNS.map((c) => (
        <div key={c} className="rounded-card soft-inset p-3">
          <Skeleton className="mb-3 h-4 w-24" />
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-[20px]" />
            <Skeleton className="h-24 w-full rounded-[20px]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TaskBoard() {
  const { org, can } = useAuth();
  const toast = useToast();
  const { members, byId } = useMembers();
  const { get, set } = useUrlState();
  const editable = can("member");

  const assigneeFilter = get("assignee");
  const taskParam = get("task");
  const newParam = get("new") === "1";
  const obligationParam = get("obligation");

  const tasksQ = useQuery<TaskOut[]>("tasks:all", (signal) => api.tasks.list({ limit: 500 }, { signal }));
  // Linked-obligation context for cards (severity + instrument reference).
  const obligationsQ = useQuery("tasks:obligations", (signal) =>
    api.obligations.list({ limit: 200, include_retired: true }, { signal }),
  );
  const obligationById = useMemo(
    () => new Map((obligationsQ.data?.items ?? []).map((o) => [o.id, o])),
    [obligationsQ.data],
  );

  const [dragId, setDragId] = useState<string | null>(null);
  const [submitTask, setSubmitTask] = useState<TaskOut | null>(null);
  // Tasks deleted from this page: their ids may linger in the URL for a moment after closing.
  const deleted = useRef(new Set<string>());
  const [dropCol, setDropCol] = useState<TaskStatus | null>(null);

  const tasks = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);
  const visible = useMemo(
    () =>
      tasks.filter((t) =>
        !assigneeFilter ? true : assigneeFilter === "none" ? t.assignee_id === null : t.assignee_id === assigneeFilter,
      ),
    [tasks, assigneeFilter],
  );

  const editingTask = taskParam ? tasks.find((t) => t.id === taskParam) : undefined;

  // A deep link to a task that no longer exists: say so and drop the parameter.
  useEffect(() => {
    if (taskParam && tasksQ.data && !tasksQ.data.some((t) => t.id === taskParam) && !deleted.current.has(taskParam)) {
      toast.error("That task no longer exists", "It may have been deleted or replaced by a re-assessment.");
      set({ task: null });
    }
  }, [taskParam, tasksQ.data, toast, set]);

  const stats = useMemo(() => {
    const open = tasks.filter((t) => t.status !== "done");
    return {
      open: open.length,
      overdue: open.filter((t) => t.due_on && daysUntil(t.due_on) < 0).length,
      week: open.filter((t) => t.due_on && daysUntil(t.due_on) >= 0 && daysUntil(t.due_on) <= 7).length,
      suggested: open.filter((t) => t.source === "ai" || t.source === "ai_edited").length,
      awaiting: tasks.filter((t) => t.approval_id).length,
    };
  }, [tasks]);

  async function move(task: TaskOut, status: TaskStatus) {
    if (task.status === status || !editable) return;
    if (task.approval_id) {
      toast.error("Waiting for approval", "This task's status is locked until the checker decides. Open it from Approvals.");
      return;
    }
    // Maker-checker: review and done go through an approval request instead of a PATCH.
    if (task.requires_approval && (status === "review" || status === "done")) {
      setSubmitTask(task);
      return;
    }
    tasksQ.setData((prev) => (prev ?? []).map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      const saved = await api.tasks.update(task.id, { status });
      tasksQ.setData((prev) => (prev ?? []).map((t) => (t.id === saved.id ? saved : t)));
      toast.success(`Moved to ${label(TASK_STATUS_LABEL, status)}`);
    } catch (e) {
      tasksQ.setData((prev) => (prev ?? []).map((t) => (t.id === task.id ? task : t)));
      if (e instanceof ApiError && e.status === 409 && (status === "review" || status === "done") && !task.approval_id) {
        // The server knows better (e.g. maker-checker was just switched on): ask for approval.
        setSubmitTask({ ...task, requires_approval: true });
        return;
      }
      toast.error("Couldn't move the task", errorMessage(e));
    }
  }

  function onDrop(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    setDropCol(null);
    setDragId(null);
    const id = e.dataTransfer.getData(DRAG_TYPE);
    const task = tasks.find((t) => t.id === id);
    if (task) void move(task, status);
  }

  const closeDialog = () => set({ task: null, new: null, obligation: null });

  const assigneeOptions = [
    { value: "none", label: "Unassigned" },
    ...members.map((m) => ({ value: m.user.id, label: m.user.name })),
  ];

  return (
    <div>
      <PageHeader
        eyebrow={org?.name}
        title="Tasks"
        description="Remediation and compliance work, from Obligraph's suggested fixes to sign-off."
        actions={
          <>
            <FilterSelect
              label="Assignee"
              value={assigneeFilter}
              onChange={(v) => set({ assignee: v || null })}
              options={assigneeOptions}
              allLabel="Everyone"
            />
            {editable && (
              <Button variant="primary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => set({ new: "1", task: null })}>
                New task
              </Button>
            )}
          </>
        }
      />

      {tasksQ.data && tasks.length > 0 && (
        <p className="-mt-1 mb-6 flex flex-wrap items-center gap-2.5 text-[12.5px] text-ink-2 [&>*]:inline-flex [&>*]:h-9 [&>*]:items-center [&>*]:gap-1.5 [&>*]:rounded-full [&>*]:px-4">
          <span className="soft-xs">
            <span className="num figure text-[15px] text-ink">{stats.open}</span> open
          </span>
          <span className={stats.overdue ? "soft-xs text-danger" : "soft-xs"}>
            <span className="num figure text-[15px]">{stats.overdue}</span> overdue
          </span>
          <span className="soft-xs">
            <span className="num figure text-[15px] text-ink">{stats.week}</span> due in the next 7 days
          </span>
          <span className="soft-xs">
            <span className="num figure text-[15px] text-ink">{stats.suggested}</span> suggested by Obligraph
          </span>
          {stats.awaiting > 0 && (
            <Link href="/approvals" className="soft-xs hover:text-accent">
              <span className="num figure text-[15px] text-accent">{stats.awaiting}</span> awaiting approval
            </Link>
          )}
          {!editable && <span className="text-ink-3">You have view-only access.</span>}
        </p>
      )}

      {!tasksQ.data && tasksQ.error == null && <BoardSkeleton />}
      {tasksQ.error != null && !tasksQ.data && (
        <Panel>
          <ErrorState error={tasksQ.error} onRetry={tasksQ.reload} />
        </Panel>
      )}

      {tasksQ.data && tasks.length === 0 && (
        <Panel>
          <EmptyState
            icon={<SquareKanban size={22} />}
            title="No tasks yet"
            action={
              editable && (
                <Button variant="primary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => set({ new: "1" })}>
                  New task
                </Button>
              )
            }
          >
            Obligraph suggests tasks when it finds a gap between a requirement and your policies. You can also add your own.
          </EmptyState>
        </Panel>
      )}

      {tasksQ.data && tasks.length > 0 && (
        <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-4">
          {TASK_COLUMNS.map((status) => {
            const items = visible.filter((t) => t.status === status);
            const isTarget = dropCol === status && dragId !== null;
            return (
              <section
                key={status}
                aria-label={`${label(TASK_STATUS_LABEL, status)}, ${items.length} tasks`}
                onDragOver={(e) => {
                  if (!editable || !e.dataTransfer.types.includes(DRAG_TYPE)) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dropCol !== status) setDropCol(status);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropCol((c) => (c === status ? null : c));
                }}
                onDrop={(e) => onDrop(e, status)}
                className={clsx(
                  "flex min-h-40 flex-col rounded-card p-3 transition-[background-color,box-shadow]",
                  isTarget ? "bg-accent-wash shadow-inset ring-2 ring-accent/60" : "soft-inset",
                )}
              >
                <header className="mb-3 flex items-center gap-2 px-2 pt-1.5">
                  <h2 className="display text-[15px]">{label(TASK_STATUS_LABEL, status)}</h2>
                  <CountBadge count={items.length} max={99} tone={status === "done" ? "soft" : "solid"} />
                  <span className="ml-auto text-[11.5px] text-ink-3">{COLUMN_HINT[status]}</span>
                </header>
                <div className="flex flex-1 flex-col gap-3">
                  {items.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      obligation={t.obligation_id ? obligationById.get(t.obligation_id) : undefined}
                      assignee={t.assignee_id ? byId.get(t.assignee_id) : undefined}
                      editable={editable}
                      dragging={dragId === t.id}
                      onDragState={setDragId}
                      onOpen={() => set({ task: t.id, new: null })}
                      onMove={(s) => void move(t, s)}
                    />
                  ))}
                  {items.length === 0 && (
                    <p className="flex flex-1 items-center justify-center rounded-[20px] border border-dashed border-line-strong px-3 py-6 text-center text-[12.5px] text-ink-3">
                      {isTarget ? "Drop to move here" : assigneeFilter ? "No tasks for this assignee" : "No tasks"}
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <SubmitForApprovalDialog
        task={submitTask}
        onClose={() => setSubmitTask(null)}
        onSubmitted={(a) =>
          tasksQ.setData((prev) =>
            (prev ?? []).map((t) => (t.id === a.task_id ? { ...t, status: "review", approval_id: a.id } : t)),
          )
        }
      />

      <TaskDialog
        open={!!editingTask || newParam}
        onClose={closeDialog}
        task={editingTask ?? null}
        obligationId={editingTask ? null : obligationParam || null}
        onSaved={(saved, mode) =>
          tasksQ.setData((prev) =>
            mode === "created" ? [...(prev ?? []), saved] : (prev ?? []).map((t) => (t.id === saved.id ? saved : t)),
          )
        }
        onDeleted={(id) => {
          deleted.current.add(id);
          tasksQ.setData((prev) => (prev ?? []).filter((t) => t.id !== id));
        }}
      />
    </div>
  );
}
