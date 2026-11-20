// Formatting helpers. Dates are shown day-month-year, as on Indian regulatory circulars.

export function humanize(key: string): string {
  const s = key.replace(/[_-]+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Parse YYYY-MM-DD as a local calendar date (no timezone shift). */
export function parseDate(d: string): Date {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return dateFmt.format(d.length <= 10 ? parseDate(d) : new Date(d));
}

export function fmtShortDate(d: string | null | undefined): string {
  if (!d) return "—";
  return shortFmt.format(d.length <= 10 ? parseDate(d) : new Date(d));
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  return dateTimeFmt.format(new Date(d));
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = (now - new Date(iso).getTime()) / 1000;
  if (diff < 45) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)} d ago`;
  return fmtDate(iso);
}

/** Whole days from today to an ISO date (negative = past). */
export function daysUntil(d: string): number {
  const today = parseDate(todayISO()).getTime();
  return Math.round((parseDate(d).getTime() - today) / 86400000);
}

export function dueLabel(d: string): string {
  const n = daysUntil(d);
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  if (n > 1) return `In ${n} days`;
  if (n === -1) return "1 day overdue";
  return `${-n} days overdue`;
}

export function fmtNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-IN").format(n);
}

export function fmtChars(n: number): string {
  if (n < 1000) return `${n} chars`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k chars`;
  return `${(n / 1_000_000).toFixed(1)}M chars`;
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function pct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${Math.round(n)}%`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export const FREQUENCY_LABEL: Record<string, string> = {
  one_time: "One-time",
  ongoing: "Ongoing",
  event_driven: "Event-driven",
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  annual: "Annual",
};

export const DOC_TYPE_LABEL: Record<string, string> = {
  master_direction: "Master direction",
  circular: "Circular",
  notification: "Notification",
  regulation: "Regulation",
  guideline: "Guideline",
  press_release: "Press release",
  other: "Other",
};

export const OBLIGATION_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  met: "Met",
  not_applicable: "Not applicable",
};

export const TASK_STATUS_LABEL: Record<string, string> = {
  todo: "To do",
  doing: "Doing",
  review: "In review",
  done: "Done",
};

export const REG_STATUS_LABEL: Record<string, string> = {
  in_force: "In force",
  superseded: "Superseded",
  not_ingested: "Not ingested",
};

export function label(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "—";
  return map[key] ?? humanize(key);
}
