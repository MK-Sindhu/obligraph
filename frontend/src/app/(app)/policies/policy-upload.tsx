"use client";

import clsx from "clsx";
import { FileUp, Lock, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button, IconButton, IconTile } from "@/components/ui/button";
import { Input, Label, Panel } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage, type PolicyOut } from "@/lib/api";
import { fmtBytes } from "@/lib/format";

const ACCEPT = ".pdf,.docx,.txt,.md,.html,.htm";
const EXTENSIONS = ["pdf", "docx", "txt", "md", "html", "htm"];
const MAX_BYTES = 20 * 1024 * 1024;

function checkFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!EXTENSIONS.includes(ext)) return `“${file.name}” isn't a supported type. Use PDF, Word (.docx), text, Markdown or HTML.`;
  if (file.size > MAX_BYTES) return `“${file.name}” is ${fmtBytes(file.size)}. The limit is 20 MB.`;
  if (file.size === 0) return `“${file.name}” is empty.`;
  return null;
}

const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

function uploadError(err: unknown): string {
  if (err instanceof ApiError) {
    // Server message: "already uploaded as '<title>'" (same text hash).
    if (err.status === 409) return `This document is ${lowerFirst(err.message)}. Nothing changed.`;
    if (err.status === 413) return "The file is larger than 20 MB. Split it or export a smaller PDF.";
    if (err.status === 422) return `Obligraph couldn't read this file: ${lowerFirst(err.message).replace(/[.\s]+$/, "")}`;
    if (err.status === 403) return "Only admins can upload policies.";
  }
  return errorMessage(err);
}

export function PolicyUpload({ canUpload, onUploaded }: { canUpload: boolean; onUploaded: (p: PolicyOut) => void }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!canUpload) {
    return (
      <Panel title="Upload a policy">
        <div className="flex gap-3 px-6 pb-6 text-[13px] text-ink-2">
          <Lock size={16} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
          <p>Only admins and owners can upload or delete policies. Ask an admin of your organisation to add new documents.</p>
        </div>
      </Panel>
    );
  }

  function choose(f: File | null | undefined) {
    if (!f) return;
    const issue = checkFile(f);
    setProblem(issue);
    setFile(issue ? null : f);
  }

  function clear() {
    setFile(null);
    setTitle("");
    setProblem(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setProblem("Choose a file to upload.");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const p = await api.policies.upload(file, title.trim() || undefined);
      toast.success("Policy uploaded", p.title);
      clear();
      onUploaded(p);
    } catch (err) {
      setProblem(uploadError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Upload a policy">
      <form onSubmit={submit} className="space-y-5 px-6 pb-6 pt-1">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            choose(e.dataTransfer.files?.[0]);
          }}
          className={clsx(
            "flex cursor-pointer flex-col items-center rounded-[24px] border-2 border-dashed px-4 py-7 text-center shadow-inset-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
            dragging ? "border-accent bg-accent-wash" : "border-line-strong bg-surface-2 hover:border-accent/50",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => choose(e.target.files?.[0])}
          />
          <IconTile tone="accent" size="lg">
            <FileUp size={22} />
          </IconTile>
          <span className="mt-3 text-[13.5px] font-medium text-ink">
            {dragging ? "Drop to attach" : "Drop a file here or browse"}
          </span>
          <span className="mt-0.5 text-[12px] text-ink-3">PDF, Word (.docx), text, Markdown or HTML · up to 20 MB</span>
        </label>

        {file && (
          <div className="flex items-center gap-3 rounded-[18px] soft-xs px-3.5 py-2.5">
            <FileUp size={16} className="shrink-0 text-accent" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{file.name}</p>
              <p className="num text-[11.5px] text-ink-3">{fmtBytes(file.size)}</p>
            </div>
            <IconButton label="Remove file" size="sm" onClick={clear} disabled={busy}>
              <X size={14} />
            </IconButton>
          </div>
        )}

        <div>
          <Label htmlFor="policy-title" hint="Optional">
            Title
          </Label>
          <Input
            id="policy-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={file ? file.name.replace(/\.[^.]+$/, "") : "e.g. KYC and AML Policy 2026"}
          />
        </div>

        {problem && (
          <p role="alert" className="rounded-[14px] border border-danger/25 bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger">
            {problem}
          </p>
        )}

        <Button type="submit" variant="primary" className="w-full" loading={busy} disabled={!file}>
          Upload policy
        </Button>
        <p className="text-[12px] leading-relaxed text-ink-3">
          After upload, Obligraph re-assesses every obligation against all your policies and updates coverage and
          suggested tasks.
        </p>
      </form>
    </Panel>
  );
}
