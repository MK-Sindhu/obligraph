"use client";

import clsx from "clsx";
import { ArrowUpRight, FileText, Plus, RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AiTag,
  CoverageBadge,
  ObligationStatusBadge,
  PriorityBadge,
  SeverityBadge,
} from "@/components/domain/badges";
import { Docket } from "@/components/domain/docket";
import { EvidenceSection } from "@/components/evidence/evidence-list";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import { Avatar, Select, Tag } from "@/components/ui/misc";
import { ErrorState, LoadingBlock, Spinner } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, type ObligationOut, type ObligationStatus, type ObligationUpdate, type TaskOut } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  daysUntil,
  dueLabel,
  fmtDate,
  fmtDateTime,
  fmtShortDate,
  FREQUENCY_LABEL,
  humanize,
  label,
  OBLIGATION_STATUS_LABEL,
  TASK_STATUS_LABEL,
} from "@/lib/format";
import { useMembers } from "@/lib/members";
import { useQuery } from "@/lib/use-query";
import { useVocab } from "@/lib/vocab";
import { TaskDialog } from "./task-dialog";
import { OBLIGATION_STATUSES, sameText, taskTitleFor } from "./utils";

function Section({ title, actions, children, className }: { title: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("border-b border-line px-7 py-5 last:border-b-0", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[12.5px] font-medium text-ink-3">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

function EvidenceQuote({ title, quote }: { title: string; quote: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = quote.length > 320;
  return (
    <figure className="rounded-[20px] border border-line bg-surface-2">
      <figcaption className="flex items-center gap-2 px-4 pb-1 pt-3 text-[12px] font-medium text-ink-2">
        <FileText size={13} className="shrink-0 text-accent" aria-hidden="true" />
        <span className="truncate">{title}</span>
      </figcaption>
      <blockquote className="px-4 pb-3 pt-1 text-[13px] leading-relaxed text-ink">
        <div className={clsx("whitespace-pre-line", !expanded && long && "line-clamp-5")}>{quote}</div>
      </blockquote>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="px-4 pb-3 text-[12px] font-medium text-accent hover:underline"
        >
          {expanded ? "Show less" : "Show full passage"}
        </button>
      )}
    </figure>
  );
}

function RelatedTasks({
  tasks,
  loading,
  error,
  onRetry,
}: {
  tasks: TaskOut[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const { byId } = useMembers();
  if (!tasks && loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-[13px] text-ink-3">
        <Spinner size={14} /> Loading tasks…
      </div>
    );
  }
  if (error != null && !tasks) return <ErrorState error={error} onRetry={onRetry} compact />;
  if (!tasks?.length) {
    return <p className="text-[13px] text-ink-3">No tasks yet. Add one to track the remediation work.</p>;
  }
  return (
    <ul className="space-y-2">
      {tasks.map((t) => {
        const overdue = t.status !== "done" && t.due_on !== null && daysUntil(t.due_on) < 0;
        const assignee = t.assignee_id ? byId.get(t.assignee_id) : undefined;
        return (
          <li key={t.id}>
            <Link
              href={`/tasks?task=${t.id}`}
              className="flex items-start gap-3 rounded-[18px] px-4 py-3 card-xs transition-shadow hover:shadow-card"
            >
              <div className="min-w-0 flex-1">
                <p className={clsx("line-clamp-2 text-[13px] leading-snug", t.status === "done" && "text-ink-3 line-through")}>{t.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-3">
                  <span className="font-medium text-ink-2">{label(TASK_STATUS_LABEL, t.status)}</span>
                  <PriorityBadge priority={t.priority} />
                  {t.due_on && (
                    <span className={clsx("num", overdue && "font-medium text-danger")} title={dueLabel(t.due_on)}>
                      Due {fmtShortDate(t.due_on)}
                    </span>
                  )}
                  <AiTag source={t.source} />
                </div>
              </div>
              {assignee && <Avatar name={assignee.user.name} size={22} />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Detail drawer for one obligation. Loads the obligation itself so deep links
 * (`/obligations?id=…`) work regardless of the list's filters and page.
 */
export function ObligationDrawer({
  id,
  onClose,
  onUpdated,
}: {
  id: string | null;
  onClose: () => void;
  onUpdated?: (ob: ObligationOut) => void;
}) {
  const obQ = useQuery<ObligationOut>(id ? `obligation:${id}` : null, (signal) => api.obligations.get(id as string, { signal }));
  const ob = obQ.data && obQ.data.id === id ? obQ.data : undefined;
  return (
    <Drawer open={!!id} onClose={onClose} title={<DrawerTitle ob={ob} />}>
      {id &&
        (ob ? (
          <ObligationDetail
            key={id}
            ob={ob}
            onChange={(updated) => {
              obQ.setData(updated);
              onUpdated?.(updated);
            }}
          />
        ) : obQ.error != null ? (
          <ErrorState error={obQ.error} onRetry={obQ.reload} />
        ) : (
          <LoadingBlock label="Loading obligation…" />
        ))}
    </Drawer>
  );
}

function DrawerTitle({ ob }: { ob: ObligationOut | undefined }) {
  if (!ob) return <p className="display pt-1 text-[17px]">Obligation</p>;
  const reg = ob.regulation;
  return (
    <div className="min-w-0">
      <Docket regulator={reg.regulator} refNo={reg.ref_no} date={reg.issued_on} />
      <Link
        href={`/regulations/${reg.id}`}
        className="mt-1.5 inline-flex max-w-full items-center gap-1 text-[14px] font-medium text-ink hover:text-accent"
      >
        <span className="truncate">{reg.title}</span>
        <ArrowUpRight size={14} className="shrink-0 text-ink-3" aria-hidden="true" />
      </Link>
    </div>
  );
}

function ObligationDetail({
  ob,
  onChange,
}: {
  ob: ObligationOut;
  onChange: (ob: ObligationOut) => void;
}) {
  const id = ob.id;
  const toast = useToast();
  const { can } = useAuth();
  const { topic, entity } = useVocab();
  const { members, byId } = useMembers();
  const canEdit = can("member");

  const tasksQ = useQuery<TaskOut[]>(`tasks:ob:${id}`, (signal) => api.tasks.list({ obligation_id: id }, { signal }));

  const [saving, setSaving] = useState<null | "status" | "owner">(null);
  const [assessing, setAssessing] = useState(false);
  const [queued, setQueued] = useState(false);
  const [taskDialog, setTaskDialog] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers;
    return () => pending.current.forEach((t) => window.clearTimeout(t));
  }, []);

  const req = ob.requirement;
  const owner = ob.owner_id ? byId.get(ob.owner_id) : undefined;

  const apply = onChange;

  async function patch(field: "status" | "owner", body: ObligationUpdate) {
    setSaving(field);
    try {
      const updated = await api.obligations.update(id, body);
      apply(updated);
      toast.success(field === "status" ? `Marked ${label(OBLIGATION_STATUS_LABEL, updated.status).toLowerCase()}` : "Owner updated");
    } catch (e) {
      toast.error("Couldn't update the obligation", errorMessage(e));
    } finally {
      setSaving(null);
    }
  }

  async function reassess(current: ObligationOut) {
    setAssessing(true);
    const before = current.assessed_at;
    try {
      await api.obligations.assess(id);
      setQueued(true);
      toast.toast({ title: "Re-assessment queued", body: "Obligraph is checking this requirement against your policies again." });
      timers.current.forEach((t) => window.clearTimeout(t));
      const delays = [2000, 5000, 10000, 20000];
      timers.current = delays.map((ms, i) =>
        window.setTimeout(async () => {
          try {
            const fresh = await api.obligations.get(id);
            if (fresh.assessed_at !== before) {
              timers.current.forEach((t) => window.clearTimeout(t));
              apply(fresh);
              tasksQ.reload();
              setQueued(false);
              toast.success("Assessment updated", `Coverage is now ${fresh.coverage}.`);
            } else if (i === delays.length - 1) {
              setQueued(false);
              toast.toast({ title: "Still in the queue", body: "The assessment hasn't finished yet. Check back in a minute." });
            }
          } catch {
            /* keep polling */
          }
        }, ms),
      );
    } catch (e) {
      toast.error("Couldn't queue the re-assessment", errorMessage(e));
    } finally {
      setAssessing(false);
    }
  }

  const showQuote = req.source_quote && !sameText(req.source_quote, req.text);

  return (
    <>
      <Section title={`Requirement ${req.ordinal + 1}`} className="pt-6">
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <SeverityBadge severity={req.severity} />
          <CoverageBadge coverage={ob.coverage} confidence={ob.confidence} />
          <ObligationStatusBadge status={ob.status} />
        </div>
        <p className="display text-[18px] leading-snug text-ink">{req.text}</p>
        {showQuote ? (
          <blockquote className="mt-4 rounded-[18px] bg-surface-2 px-4 py-3 text-[13px] italic leading-relaxed text-ink-2">
            <span className="mb-1 block text-[11.5px] font-medium not-italic text-ink-3">Source text</span>
            {req.source_quote}
          </blockquote>
        ) : (
          req.source_quote && <p className="mt-2.5 text-[12px] text-ink-3">Quoted verbatim from the instrument</p>
        )}
      </Section>

      <Section title="Tracking">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ob-status" className="mb-1 block text-[12.5px] font-medium text-ink-2">
              Status
            </label>
            {canEdit ? (
              <div className="relative">
                <Select
                  id="ob-status"
                  value={ob.status}
                  disabled={saving !== null}
                  onChange={(e) => patch("status", { status: e.target.value as ObligationStatus })}
                >
                  {OBLIGATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {label(OBLIGATION_STATUS_LABEL, s)}
                    </option>
                  ))}
                </Select>
                {saving === "status" && <Spinner size={13} className="absolute right-10 top-[13px] text-ink-3" />}
              </div>
            ) : (
              <ObligationStatusBadge status={ob.status} />
            )}
          </div>
          <div>
            <label htmlFor="ob-owner" className="mb-1 block text-[12.5px] font-medium text-ink-2">
              Owner
            </label>
            {canEdit ? (
              <div className="relative">
                <Select
                  id="ob-owner"
                  value={ob.owner_id ?? ""}
                  disabled={saving !== null}
                  onChange={(e) => patch("owner", { owner_id: e.target.value || null })}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.name}
                    </option>
                  ))}
                </Select>
                {saving === "owner" && <Spinner size={13} className="absolute right-10 top-[13px] text-ink-3" />}
              </div>
            ) : (
              <p className="flex items-center gap-2 text-[13px]">
                {owner ? (
                  <>
                    <Avatar name={owner.user.name} size={22} /> {owner.user.name}
                  </>
                ) : (
                  <span className="text-ink-3">Unassigned</span>
                )}
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section
        title="Policy coverage"
        actions={
          canEdit && (
            <Button
              size="sm"
              variant="secondary"
              loading={assessing}
              disabled={queued}
              icon={<RotateCw size={13} aria-hidden="true" />}
              onClick={() => reassess(ob)}
            >
              Re-assess
            </Button>
          )
        }
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <CoverageBadge coverage={ob.coverage} confidence={ob.confidence} className="text-[13px]" />
          <span className="text-[12px] text-ink-3">
            {ob.assessed_at
              ? `Assessed ${fmtDateTime(ob.assessed_at)}${ob.assessed_by ? ` · ${ob.assessed_by === "claude" ? "Claude" : ob.assessed_by === "offline" ? "Offline heuristic" : humanize(ob.assessed_by)}` : ""}`
              : "Not assessed yet"}
          </span>
        </div>
        {queued && (
          <p role="status" className="mt-3 flex items-center gap-2 rounded-[14px] bg-accent-wash px-3.5 py-2.5 text-[12.5px] text-accent">
            <Spinner size={13} /> Re-assessment queued. This updates automatically when it finishes.
          </p>
        )}
        {ob.rationale && <p className="mt-3 text-[13.5px] leading-relaxed text-ink">{ob.rationale}</p>}

        <h4 className="mb-2.5 mt-5 text-[12.5px] font-medium text-ink-3">Evidence from your policies</h4>
        {ob.evidence.length ? (
          <div className="space-y-2">
            {ob.evidence.map((ev) => (
              <EvidenceQuote key={ev.chunk_id} title={ev.document_title} quote={ev.quote} />
            ))}
          </div>
        ) : (
          <p className="rounded-[18px] border border-dashed border-line-strong px-4 py-3.5 text-[13px] text-ink-3">
            No supporting passage found in your policies.{" "}
            {can("admin") && (
              <Link href="/policies" className="font-medium text-accent hover:underline">
                Upload a policy
              </Link>
            )}
          </p>
        )}

        {ob.remediation && (
          <>
            <h4 className="mb-2.5 mt-5 text-[12.5px] font-medium text-ink-3">Suggested remediation</h4>
            <p className="relative rounded-[18px] bg-accent-wash/60 py-3 pl-5 pr-4 text-[13.5px] leading-relaxed">
              <span className="absolute inset-y-3 left-2 w-[3px] rounded-full bg-primary" aria-hidden="true" />
              {ob.remediation}
            </p>
          </>
        )}
      </Section>

      <Section
        title={`Tasks${tasksQ.data ? ` · ${tasksQ.data.length}` : ""}`}
        actions={
          canEdit && (
            <Button size="sm" variant="secondary" icon={<Plus size={13} aria-hidden="true" />} onClick={() => setTaskDialog(true)}>
              Add task
            </Button>
          )
        }
      >
        <RelatedTasks tasks={tasksQ.data} loading={tasksQ.loading} error={tasksQ.error} onRetry={tasksQ.reload} />
      </Section>

      <Section title="Compliance evidence">
        <EvidenceSection
          link={{ obligation_id: ob.id }}
          emptyText="No files recorded against this obligation. Attach the board minute, report or screenshot that proves it is met."
        />
      </Section>

      <Section title="Requirement details">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
          <div>
            <dt className="mb-0.5 text-[11.5px] text-ink-3">Kind</dt>
            <dd>{humanize(req.kind)}</dd>
          </div>
          <div>
            <dt className="mb-0.5 text-[11.5px] text-ink-3">Frequency</dt>
            <dd>{label(FREQUENCY_LABEL, req.frequency)}</dd>
          </div>
          <div>
            <dt className="mb-0.5 text-[11.5px] text-ink-3">Due date</dt>
            <dd className="num">
              {req.due_on ? (
                <>
                  {fmtDate(req.due_on)}{" "}
                  <span className={clsx("text-[12px]", daysUntil(req.due_on) < 0 ? "text-danger" : "text-ink-3")}>
                    ({dueLabel(req.due_on).toLowerCase()})
                  </span>
                </>
              ) : (
                <span className="text-ink-3">No fixed date</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="mb-0.5 text-[11.5px] text-ink-3">Effective</dt>
            <dd className="num">{fmtDate(ob.regulation.effective_on ?? ob.regulation.issued_on)}</dd>
          </div>
          {req.topics.length > 0 && (
            <div className="col-span-2">
              <dt className="mb-1 text-[11.5px] text-ink-3">Topics</dt>
              <dd className="flex flex-wrap gap-1">
                {req.topics.map((t) => (
                  <Tag key={t}>{topic(t)}</Tag>
                ))}
              </dd>
            </div>
          )}
          {req.entity_classes.length > 0 && (
            <div className="col-span-2">
              <dt className="mb-1 text-[11.5px] text-ink-3">Applies to</dt>
              <dd className="flex flex-wrap gap-1">
                {req.entity_classes.map((e) => (
                  <Tag key={e}>{entity(e)}</Tag>
                ))}
              </dd>
            </div>
          )}
          {req.evidence_hint && (
            <div className="col-span-2">
              <dt className="mb-0.5 text-[11.5px] text-ink-3">Evidence to keep</dt>
              <dd className="text-ink-2">{req.evidence_hint}</dd>
            </div>
          )}
        </dl>
      </Section>

      <TaskDialog
        open={taskDialog}
        onClose={() => setTaskDialog(false)}
        obligationId={ob.id}
        defaultTitle={taskTitleFor(ob)}
        onSaved={(t) => {
          tasksQ.setData((prev) => [...(prev ?? []), t]);
          apply({ ...ob, open_tasks: ob.open_tasks + 1 });
        }}
      />
    </>
  );
}
