"use client";

import clsx from "clsx";

const STYLE: Record<string, string> = {
  done: "text-ok border-[color:var(--ok)]/40",
  ok: "text-ok border-[color:var(--ok)]/40",
  success: "text-ok border-[color:var(--ok)]/40",
  running: "text-accent border-accent/40 bg-accent-wash",
  queued: "text-ink-2 border-line-strong",
  failed: "text-danger border-[color:var(--danger)]/45",
  error: "text-danger border-[color:var(--danger)]/45",
};

/** Small status pill for jobs and crawl runs. */
export function StatusPill({ status }: { status: string | null }) {
  if (!status) return <span className="text-[12px] text-ink-3">—</span>;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11px] font-medium capitalize",
        STYLE[status] ?? "border-line-strong text-ink-2",
      )}
    >
      {status === "running" && <span className="h-1.5 w-1.5 animate-[pulse-dot_1.2s_ease-in-out_infinite] rounded-full bg-current" />}
      {status}
    </span>
  );
}
