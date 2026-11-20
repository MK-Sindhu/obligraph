"use client";

import { CheckCircle2, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { glassClass } from "@/components/ui/glass";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useVocab } from "@/lib/vocab";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

function messageFor(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return "Too many requests, try again later.";
    if (e.status === 422) return `Please check the form: ${e.message}`;
    if (e.status === 404 || e.status === 502 || e.status === 503)
      return "The demo request service isn't available right now. Please try again in a few minutes.";
  }
  return errorMessage(e);
}

/** "Request a demo": posts to /api/public/demo-requests. */
export function ContactForm() {
  const { vocab } = useVocab();
  const [f, setF] = useState({ name: "", email: "", company: "", role: "", entity_type: "", message: "", website: "" });
  const [state, setState] = useState<State>({ kind: "idle" });
  const done = useRef<HTMLDivElement>(null);
  // Bring the confirmation into view and announce it once the form collapses.
  useEffect(() => {
    if (state.kind !== "sent") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    done.current?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    done.current?.focus({ preventScroll: true });
  }, [state.kind]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "sending" });
    try {
      await api.public.demoRequest({
        name: f.name.trim(),
        email: f.email.trim(),
        company: f.company.trim(),
        role: f.role.trim() || undefined,
        entity_type: f.entity_type || undefined,
        message: f.message.trim() || undefined,
        website: f.website,
      });
      setState({ kind: "sent" });
    } catch (err) {
      setState({ kind: "error", message: messageFor(err) });
    }
  }

  if (state.kind === "sent") {
    return (
      <div ref={done} tabIndex={-1} role="status" className={glassClass("strong", "lg", "flex flex-col items-center px-8 py-14 text-center outline-none")}>
        <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[var(--cov-covered-bg)] text-ok">
          <CheckCircle2 size={26} aria-hidden="true" />
        </span>
        <h2 className="display mt-5 text-[22px] text-ink">Thanks, your request is in</h2>
        <p className="mt-2 max-w-sm text-[14.5px] leading-relaxed text-ink-2">
          We&rsquo;ll reply to {f.email} to arrange a time. If you need to change anything, just send another request.
        </p>
        <Link href="/product" className="mt-6 rounded-full text-[14px] font-medium text-accent hover:underline">
          Meanwhile, see how each module works
        </Link>
      </div>
    );
  }

  const busy = state.kind === "sending";
  return (
    <form onSubmit={submit} className={glassClass("strong", "lg", "px-6 py-8 sm:px-9 sm:py-10")} aria-describedby="demo-consent">
      <h2 className="display text-[22px] text-ink">Request a demo</h2>
      <p className="mt-1.5 text-[14px] text-ink-2">Tell us a little about you. Fields marked optional can be left blank.</p>
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="d-name">Name</Label>
          <Input id="d-name" required autoComplete="name" maxLength={200} value={f.name} onChange={set("name")} disabled={busy} />
        </div>
        <div>
          <Label htmlFor="d-email">Work email</Label>
          <Input id="d-email" type="email" required autoComplete="email" maxLength={254} value={f.email} onChange={set("email")} disabled={busy} placeholder="you@company.in" />
        </div>
        <div>
          <Label htmlFor="d-company">Company</Label>
          <Input id="d-company" required autoComplete="organization" maxLength={200} value={f.company} onChange={set("company")} disabled={busy} />
        </div>
        <div>
          <Label htmlFor="d-role" hint="Optional">
            Role
          </Label>
          <Input id="d-role" autoComplete="organization-title" maxLength={200} value={f.role} onChange={set("role")} disabled={busy} placeholder="e.g. Chief Compliance Officer" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="d-entity" hint="Optional">
            Entity type
          </Label>
          <Select id="d-entity" value={f.entity_type} onChange={set("entity_type")} disabled={busy}>
            <option value="">Choose one</option>
            {(vocab?.entity_classes ?? []).map((ec) => (
              <option key={ec.key} value={ec.key}>
                {ec.label} ({ec.regulator})
              </option>
            ))}
            <option value="other">Other</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="d-message" hint="Optional">
            Message
          </Label>
          <Textarea id="d-message" rows={4} maxLength={4000} value={f.message} onChange={set("message")} disabled={busy} placeholder="What you'd like to see, or questions from your team." />
        </div>
        {/* Honeypot for bots: hidden from people and assistive tech; must stay empty. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="d-website">Leave this field empty</label>
          <input id="d-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} />
        </div>
      </div>
      {state.kind === "error" && (
        <p role="alert" className="mt-5 rounded-[14px] border border-danger/25 bg-danger-bg px-4 py-3 text-[13.5px] text-danger">
          {state.message}
        </p>
      )}
      <p id="demo-consent" className="mt-6 text-[12.5px] leading-relaxed text-ink-2">
        We use these details only to reply to your request. See the{" "}
        <Link href="/privacy" className="font-medium text-accent underline underline-offset-2">
          privacy notice
        </Link>{" "}
        for how long we keep them and how to ask for deletion.
      </p>
      <Button type="submit" variant="primary" size="lg" loading={busy} icon={<Send size={15} aria-hidden="true" />} className="mt-6 w-full sm:w-auto">
        {busy ? "Sending…" : "Request a demo"}
      </Button>
    </form>
  );
}
