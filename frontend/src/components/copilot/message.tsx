"use client";

import clsx from "clsx";
import { AlertTriangle, FileText, Square } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/brand";
import { RegStatusBadge, RegulatorTag } from "@/components/domain/badges";
import type { Citation } from "@/lib/api";
import { humanize } from "@/lib/format";
import { AnswerMarkdown } from "./markdown";

export interface ToolStep {
  name: string;
  input: Record<string, unknown>;
}

export interface ChatItem {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations: Citation[];
  tools: ToolStep[];
  status: "done" | "streaming" | "stopped" | "error";
  error?: string;
}

const TOOL_LABEL: Record<string, string> = {
  search_regulations: "Searching regulations",
  get_regulation: "Reading the regulation",
  trace_lineage: "Tracing lineage",
  regulations_in_force_on: "Checking what was in force",
  list_obligations: "Reviewing your obligations",
  list_tasks: "Reviewing tasks",
  upcoming_deadlines: "Checking upcoming deadlines",
  search_policies: "Searching your policies",
  get_org_profile: "Reading your organisation profile",
};

const SUMMARY_KEYS = ["query", "q", "ref_no", "regulation", "regulation_id", "title", "on", "date", "topic", "coverage", "status", "days"];

function toolSummary(input: Record<string, unknown>): string | null {
  for (const k of SUMMARY_KEYS) {
    const v = input[k];
    if (typeof v === "string" && v.trim()) return v.length > 64 ? `${v.slice(0, 62)}…` : v;
    if (typeof v === "number") return k === "days" ? `${v} days` : String(v);
  }
  return null;
}

function ToolActivity({ tools, live }: { tools: ToolStep[]; live: boolean }) {
  if (!tools.length) return null;
  return (
    <ol className="mb-3 space-y-1.5 rounded-[18px] bg-surface-2 px-4 py-3 shadow-inset-sm" aria-label="Copilot activity">
      {tools.map((t, i) => {
        const latest = live && i === tools.length - 1;
        const summary = toolSummary(t.input);
        return (
          <li key={i} className="flex items-center gap-2 text-[12.5px] text-ink-2">
            <span
              aria-hidden="true"
              className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", latest ? "animate-[pulse-dot_1.1s_ease-in-out_infinite] bg-accent" : "bg-ink-4")}
            />
            <span className={latest ? "font-medium text-ink" : undefined}>
              {TOOL_LABEL[t.name] ?? humanize(t.name)}
              {latest ? "…" : ""}
            </span>
            {summary && <span className="min-w-0 truncate font-mono text-[11px] text-ink-3">{summary}</span>}
          </li>
        );
      })}
    </ol>
  );
}

function dedupe(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  return citations.filter((c) => {
    const key = c.kind === "regulation" ? `r:${c.regulation_id ?? c.title}` : `p:${c.document_id ?? c.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function CitationChips({ citations }: { citations: Citation[] }) {
  const list = dedupe(citations);
  if (!list.length) return null;
  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="mb-2.5 text-[12px] font-medium text-ink-3">Sources</p>
      <ul className="flex flex-wrap gap-2">
        {list.map((c, i) => {
          const isReg = c.kind === "regulation" && c.regulation_id;
          const title = c.title.length > 56 ? `${c.title.slice(0, 54)}…` : c.title;
          return (
            <li key={i} className="max-w-full">
              {isReg ? (
                <Link
                  href={`/regulations/${c.regulation_id}`}
                  title={c.title}
                  className="flex max-w-full items-center gap-1.5 rounded-full soft-xs py-1.5 pl-1.5 pr-3 text-[12px] transition-[box-shadow,color] hover:text-accent hover:shadow-raised-sm"
                >
                  {c.regulator && <RegulatorTag regulator={c.regulator} />}
                  {c.ref_no && <span className="hidden shrink-0 font-mono text-[10.5px] text-ink-2 sm:inline">{c.ref_no}</span>}
                  <span className="min-w-0 truncate text-ink">{title}</span>
                  {c.status && c.status !== "in_force" && <RegStatusBadge status={c.status} />}
                </Link>
              ) : (
                <Link
                  href="/policies"
                  title={c.title}
                  className="flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[12px] transition-colors hover:border-accent/40"
                >
                  <FileText size={13} className="shrink-0 text-ink-3" aria-hidden="true" />
                  <span className="text-[11px] font-medium text-ink-3">Policy</span>
                  <span className="min-w-0 truncate text-ink">{title}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MessageView({ item }: { item: ChatItem }) {
  if (item.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-[22px] rounded-br-[8px] bg-accent-grad-text px-4 py-3 text-[14px] leading-relaxed text-white shadow-glow-sm">
          {item.text}
        </div>
      </div>
    );
  }

  const live = item.status === "streaming";
  return (
    <article className="min-w-0" aria-live={live ? "polite" : undefined} aria-busy={live}>
      <p className="mb-2.5 flex items-center gap-2 text-[12.5px] font-medium text-ink-2">
        <LogoMark size={20} /> Copilot
      </p>
      <ToolActivity tools={item.tools} live={live && !item.text} />
      {item.text ? (
        <AnswerMarkdown text={item.text} />
      ) : (
        live &&
        item.tools.length === 0 && (
          <p className="flex items-center gap-1 text-[13px] text-ink-3" role="status">
            <span className="sr-only">Working on an answer</span>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-ink-3 animate-[pulse-dot_1.1s_ease-in-out_infinite]"
                style={{ animationDelay: `${i * 160}ms` }}
              />
            ))}
          </p>
        )
      )}
      {live && item.text && (
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-3">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent animate-[pulse-dot_1.1s_ease-in-out_infinite]" />
          Writing…
        </p>
      )}
      {item.status === "stopped" && (
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ink-3">
          <Square size={11} aria-hidden="true" /> Stopped before the answer finished.
        </p>
      )}
      {item.status === "error" && (
        <p role="alert" className="mt-2 flex items-start gap-2 rounded-[14px] bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {item.error ?? "Copilot couldn't finish this answer."}
        </p>
      )}
      <CitationChips citations={item.citations} />
    </article>
  );
}
