"use client";

import { Building2, LockKeyhole, Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EntityClassPicker } from "@/components/domain/entity-picker";
import { Button } from "@/components/ui/button";
import { CornerTab } from "@/components/ui/card";
import { InsetField, Label } from "@/components/ui/field";
import { InlineError } from "@/components/ui/states";
import { api } from "@/lib/api";
import { storeSession } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", org_name: "" });
  const [classes, setClasses] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [touched, setTouched] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!classes.length) return;
    setBusy(true);
    setError(null);
    try {
      const s = await api.auth.register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        org_name: form.org_name.trim(),
        entity_classes: classes,
      });
      storeSession(s);
      router.replace("/dashboard");
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <div>
      <title>Create an organisation · Obligraph</title>
      <form onSubmit={submit} className="relative rounded-card-lg card px-7 pb-8 pt-10 sm:px-10">
        <CornerTab />
        <h1 className="label-caps text-center text-[22px] leading-tight">Create an organisation</h1>
        <p className="mt-2 text-center text-[13px] text-ink-3">Your entity types decide which circulars apply.</p>
        <div className="mt-7 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Your name</Label>
              <InsetField id="name" required autoComplete="name" value={form.name} onChange={set("name")} trailing={<UserRound size={16} className="mr-2.5 text-ink-3" aria-hidden="true" />} />
            </div>
            <div>
              <Label htmlFor="email">Work email</Label>
              <InsetField id="email" type="email" required autoComplete="email" value={form.email} onChange={set("email")} trailing={<Mail size={16} className="mr-2.5 text-ink-3" aria-hidden="true" />} />
            </div>
          </div>
          <div>
            <Label htmlFor="password" hint="At least 8 characters">
              Password
            </Label>
            <InsetField
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={form.password}
              onChange={set("password")}
              trailing={<LockKeyhole size={16} className="mr-2.5 text-ink-3" aria-hidden="true" />}
            />
          </div>
          <div>
            <Label htmlFor="org">Organisation name</Label>
            <InsetField
              id="org"
              required
              autoComplete="organization"
              placeholder="e.g. Shakti Finance Ltd"
              value={form.org_name}
              onChange={set("org_name")}
              trailing={<Building2 size={16} className="mr-2.5 text-ink-3" aria-hidden="true" />}
            />
          </div>
          <div>
            <p id="classes-label" className="mb-3 flex items-baseline justify-between gap-2 text-[12.5px] font-medium text-ink-2">
              <span>What kind of entity are you?</span>
              <span className="font-normal text-ink-3">{classes.length ? `${classes.length} selected` : "Choose at least one"}</span>
            </p>
            <EntityClassPicker id="classes" value={classes} onChange={setClasses} />
            {touched && !classes.length && (
              <p className="mt-2 text-[12.5px] text-danger">Choose at least one entity type so we can match regulations to you.</p>
            )}
          </div>
          <InlineError error={error} />
        </div>
        <Button type="submit" variant="primary" size="lg" loading={busy} className="mt-7 w-full uppercase tracking-[0.08em]">
          Create organisation
        </Button>
      </form>
      <p className="mt-8 text-center text-[13px] text-ink-2">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
