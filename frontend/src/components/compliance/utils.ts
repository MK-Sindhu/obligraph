import type { ObligationOut, TaskPriority, TaskStatus } from "@/lib/api";

export const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Same order the API uses: severity, then newest instrument, then clause order. */
export function compareObligations(a: ObligationOut, b: ObligationOut): number {
  const s = (SEVERITY_RANK[a.requirement.severity] ?? 4) - (SEVERITY_RANK[b.requirement.severity] ?? 4);
  if (s) return s;
  const ia = a.regulation.issued_on ?? "";
  const ib = b.regulation.issued_on ?? "";
  if (ia !== ib) return ia < ib ? 1 : -1;
  return a.requirement.ordinal - b.requirement.ordinal;
}

export const TASK_COLUMNS: TaskStatus[] = ["todo", "doing", "review", "done"];

export const PRIORITIES: TaskPriority[] = ["urgent", "high", "medium", "low"];

export const OBLIGATION_STATUSES = ["open", "in_progress", "met", "not_applicable"] as const;

/** Default title for a task raised from an obligation. */
export function taskTitleFor(ob: Pick<ObligationOut, "coverage" | "requirement">): string {
  const verb = ob.coverage === "missing" ? "Add policy clause" : ob.coverage === "partial" ? "Close partial gap" : "Keep evidence";
  const text = ob.requirement.text.replace(/\s+/g, " ").trim();
  const short = text.length > 110 ? `${text.slice(0, 107).trimEnd()}…` : text;
  return `${verb}: ${short}`;
}

export function sameText(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  return norm(a) === norm(b);
}
