"use client";

import clsx from "clsx";
import { CheckSquare, FileStack, Flag, Repeat } from "lucide-react";
import type { CalendarEvent } from "@/lib/api";
import { FREQUENCY_LABEL, label } from "@/lib/format";

export const EVENT_KIND_LABEL: Record<string, string> = {
  deadline: "Deadline",
  recurring: "Recurring filing",
  task: "Task due",
  filing: "Filing due",
};

/** Statuses that mean the event no longer needs doing. */
export const EVENT_DONE_STATUSES = new Set(["done", "met", "filed", "late", "waived"]);

export function EventKindIcon({ kind, size = 13, className }: { kind: string; size?: number; className?: string }) {
  const Icon = kind === "deadline" ? Flag : kind === "recurring" ? Repeat : kind === "filing" ? FileStack : CheckSquare;
  return <Icon size={size} className={clsx("shrink-0", className)} aria-label={EVENT_KIND_LABEL[kind] ?? kind} />;
}

/** Where a calendar/deadline event leads: the task, or the obligation behind it. */
export function eventHref(e: Pick<CalendarEvent, "kind" | "task_id" | "obligation_id" | "regulation_id" | "filing_id">): string | null {
  if (e.kind === "filing" && e.filing_id) return `/filings?filing=${e.filing_id}`;
  if (e.kind === "task" && e.task_id) return `/tasks?task=${e.task_id}`;
  if (e.obligation_id) return `/obligations?id=${e.obligation_id}`;
  if (e.regulation_id) return `/regulations/${e.regulation_id}`;
  return null;
}

export function eventSubtitle(e: CalendarEvent): string {
  const parts: string[] = [EVENT_KIND_LABEL[e.kind] ?? e.kind];
  if ((e.kind === "recurring" || e.kind === "filing") && e.frequency) parts.push(label(FREQUENCY_LABEL, e.frequency));
  if (e.kind === "filing" && e.status && e.status !== "pending" && e.status !== "overdue") parts.push(e.status === "late" ? "filed late" : e.status);
  if (e.regulator) parts.push(e.regulator);
  if (e.regulation_title) parts.push(e.regulation_title);
  return parts.join(" · ");
}
