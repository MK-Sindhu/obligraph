"use client";

import { CheckCircle2, FileUp, Info } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button, IconTile } from "@/components/ui/button";
import { Input, Label, Panel, Segmented, Select, Textarea } from "@/components/ui/misc";
import { InlineError } from "@/components/ui/states";
import { api, type IngestResult } from "@/lib/api";
import { fmtBytes } from "@/lib/format";
import { useVocab } from "@/lib/vocab";

type Mode = "text" | "file";
const MIN_TEXT = 40;

function RegulatorSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const { vocab } = useVocab();
  return (
    <Select id={id} required value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>
        Choose a regulator
      </option>
      {(vocab?.regulators ?? []).map((r) => (
        <option key={r.key} value={r.key}>
          {r.key} — {r.label}
        </option>
      ))}
    </Select>
  );
}

function ResultNotice({ result, onDismiss }: { result: IngestResult; onDismiss: () => void }) {
  return (
    <div role="status" className="flex gap-3 rounded-[22px] border border-accent/20 bg-accent-wash px-5 py-4 text-[13px]">
      {result.created ? (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
      ) : (
        <Info size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">
          {result.created ? "Queued for extraction" : "This document is already in the corpus"}
        </p>
        <p className="mt-0.5 text-ink-2">
          {result.created
            ? "Obligraph extracts requirements, links lineage and matches organisations in the background. It appears under "
            : "Nothing new was ingested. Find it under "}
          <Link href="/regulations" className="font-medium text-accent hover:underline">
            Regulations
          </Link>
          {result.created ? " once processing finishes." : "."}
        </p>
        <p className="mt-1.5 font-mono text-[11px] text-ink-3">
          document {result.document_id} · status {result.status}
        </p>
        <button type="button" onClick={onDismiss} className="mt-1.5 rounded-full text-[12.5px] font-medium text-accent hover:underline">
          Ingest another
        </button>
      </div>
    </div>
  );
}

function TextForm({ onResult }: { onResult: (r: IngestResult) => void }) {
  const [f, setF] = useState({ title: "", regulator: "", url: "", published_on: "", text: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const short = f.text.trim().length < MIN_TEXT;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (short) {
      setError(new Error(`Paste at least ${MIN_TEXT} characters of the circular's text.`));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api.regulations.ingestText({
        title: f.title.trim(),
        regulator: f.regulator,
        text: f.text,
        url: f.url.trim() || null,
        published_on: f.published_on || null,
      });
      setF({ title: "", regulator: "", url: "", published_on: "", text: "" });
      onResult(r);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <Label htmlFor="ing-title">Title</Label>
          <Input
            id="ing-title"
            required
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
            placeholder="e.g. Master Direction – Know Your Customer (KYC) Directions"
          />
        </div>
        <div>
          <Label htmlFor="ing-reg">Regulator</Label>
          <RegulatorSelect id="ing-reg" value={f.regulator} onChange={(v) => setF({ ...f, regulator: v })} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <Label htmlFor="ing-url" hint="Optional">
            Source URL
          </Label>
          <Input
            id="ing-url"
            type="url"
            value={f.url}
            onChange={(e) => setF({ ...f, url: e.target.value })}
            placeholder="https://www.rbi.org.in/…"
          />
        </div>
        <div>
          <Label htmlFor="ing-date" hint="Optional">
            Published on
          </Label>
          <Input id="ing-date" type="date" value={f.published_on} onChange={(e) => setF({ ...f, published_on: e.target.value })} />
        </div>
      </div>
      <div>
        <Label htmlFor="ing-text" hint={<span className="num">{f.text.trim().length.toLocaleString("en-IN")} characters</span>}>
          Full text
        </Label>
        <Textarea
          id="ing-text"
          rows={9}
          required
          value={f.text}
          onChange={(e) => setF({ ...f, text: e.target.value })}
          placeholder="Paste the circular, including its reference number, date and addressees."
          className="font-mono text-[12.5px]"
        />
      </div>
      <InlineError error={error} />
      <Button type="submit" variant="primary" loading={busy}>
        Ingest regulation
      </Button>
    </form>
  );
}

function FileForm({ onResult }: { onResult: (r: IngestResult) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [regulator, setRegulator] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError(new Error("Choose a file to ingest."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api.regulations.upload(file, regulator, title.trim() || undefined);
      setFile(null);
      setTitle("");
      if (inputRef.current) inputRef.current.value = "";
      onResult(r);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="ing-file">Document</Label>
        <label className="flex cursor-pointer items-center gap-3.5 rounded-[22px] border-2 border-dashed border-line-strong bg-surface-2 px-4 py-3.5 hover:border-accent/50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
          <IconTile tone="accent" size="md">
            <FileUp size={18} />
          </IconTile>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{file ? file.name : "Choose a PDF, Word, text or HTML file"}</span>
            <span className="block text-[12px] text-ink-3">{file ? fmtBytes(file.size) : "The original circular as published"}</span>
          </span>
          <input
            ref={inputRef}
            id="ing-file"
            type="file"
            accept=".pdf,.docx,.txt,.md,.html,.htm"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <Label htmlFor="ing-file-reg">Regulator</Label>
          <RegulatorSelect id="ing-file-reg" value={regulator} onChange={setRegulator} />
        </div>
        <div>
          <Label htmlFor="ing-file-title" hint="Optional; defaults to the file name">
            Title
          </Label>
          <Input id="ing-file-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
      </div>
      <InlineError error={error} />
      <Button type="submit" variant="primary" loading={busy} disabled={!file}>
        Ingest file
      </Button>
    </form>
  );
}

export function IngestPanel({ onIngested }: { onIngested: () => void }) {
  const [mode, setMode] = useState<Mode>("text");
  const [result, setResult] = useState<IngestResult | null>(null);

  function done(r: IngestResult) {
    setResult(r);
    onIngested();
  }

  return (
    <Panel
      title="Ingest a regulation"
      meta="Adds to the shared corpus for every organisation"
      actions={
        <Segmented<Mode>
          label="Ingest from"
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: "text", label: "Paste text" },
            { value: "file", label: "Upload file" },
          ]}
        />
      }
    >
      <div className="px-6 pb-6 pt-1">
        {result ? (
          <ResultNotice result={result} onDismiss={() => setResult(null)} />
        ) : mode === "text" ? (
          <TextForm onResult={done} />
        ) : (
          <FileForm onResult={done} />
        )}
      </div>
    </Panel>
  );
}
