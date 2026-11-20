"use client";

import clsx from "clsx";
import { fmtDate, label, DOC_TYPE_LABEL } from "@/lib/format";

/**
 * The reference strip printed at the head of every circular:
 * REGULATOR · REF NO · DATE (· DOC TYPE). Rendered in mono caps.
 */
export function Docket({
  regulator,
  refNo,
  date,
  docType,
  className,
}: {
  regulator?: string | null;
  refNo?: string | null;
  date?: string | null;
  docType?: string | null;
  className?: string;
}) {
  const parts = [
    regulator,
    refNo,
    date ? fmtDate(date) : null,
    docType ? label(DOC_TYPE_LABEL, docType) : null,
  ].filter(Boolean) as string[];
  return (
    <p className={clsx("docket truncate", className)} title={parts.join(" · ")}>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="px-1.5 text-ink-3">·</span>}
          <span className={i === 0 ? "font-semibold text-ink" : undefined}>{p}</span>
        </span>
      ))}
    </p>
  );
}
