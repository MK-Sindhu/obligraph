"use client";

import { Building2, LockKeyhole, Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EntityClassPicker } from "@/components/domain/entity-picker";
import { Button } from "@/components/ui/button";
import { UnderlineField } from "@/components/ui/field";
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
      <form onSubmit={submit} className="relative pb-7">
        <div className="rounded-card-lg soft px-7 pb-14 pt-9 sm:px-9">
          <h1 className="display text-[26px] leading-tight text-ink">Create an organisation</h1>
          <p className="mt-1.5 text-[13.5px] text-ink-2">
            Obligraph uses your entity types to work out which circulars and directions apply to you.
          </p>
          <div className="mt-7 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <UnderlineField id="name" label="Your name" required autoComplete="name" value={form.name} onChange={set("name")} icon={<UserRound size={16} />} />
              <UnderlineField id="email" label="Work email" type="email" required autoComplete="email" value={form.email} onChange={set("email")} icon={<Mail size={16} />} />
            </div>
            <UnderlineField
              id="password"
              label={
                <>
                  Password <span className="font-normal text-ink-3">· at least 8 characters</span>
                </>
              }
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={form.password}
              onChange={set("password")}
              icon={<LockKeyhole size={16} />}
            />
            <UnderlineField
              id="org"
              label="Organisation name"
              required
              autoComplete="organization"
              placeholder="e.g. Shakti Finance Ltd"
              value={form.org_name}
              onChange={set("org_name")}
              icon={<Building2 size={16} />}
            />
            <div>
              <p id="classes-label" className="mb-3 flex items-baseline justify-between gap-2 text-[12.5px] font-medium text-ink-3">
                <span>What kind of entity are you?</span>
                <span className="font-normal">{classes.length ? `${classes.length} selected` : "Choose at least one"}</span>
              </p>
              <EntityClassPicker id="classes" value={classes} onChange={setClasses} />
              {touched && !classes.length && (
                <p className="mt-2 text-[12.5px] text-danger">Choose at least one entity type so we can match regulations to you.</p>
              )}
            </div>
            <InlineError error={error} />
          </div>
        </div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={busy}
          className="absolute bottom-0 left-1/2 w-[min(280px,80%)] -translate-x-1/2"
        >
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
