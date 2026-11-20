"use client";

import { Eye, EyeOff, KeyRound, Mail, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { UnderlineField } from "@/components/ui/field";
import { InlineError } from "@/components/ui/states";
import { api, type SsoConfig } from "@/lib/api";
import { storeSession, useStoredSession } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";

const DEMO = { email: "demo@obligraph.dev", password: "obligraph-demo" };

function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { hydrated, session } = useStoredSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // SSO is optional; a failed lookup just hides the button.
  const sso = useQuery<SsoConfig>("auth:sso", (signal) => api.auth.sso({ signal }));

  // Already signed in: go straight to the app.
  useEffect(() => {
    if (hydrated && session) router.replace(next);
  }, [hydrated, session, router, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await api.auth.login({ email: email.trim(), password });
      storeSession(s);
      router.replace(next);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="relative pb-7">
        <div className="rounded-card-lg soft px-7 pb-14 pt-9 sm:px-9">
          <h1 className="display text-[26px] leading-tight text-ink">Sign in</h1>
          <p className="mt-1.5 text-[13.5px] text-ink-2">Use the email and password for your Obligraph account.</p>
          <div className="mt-8 space-y-6">
            <UnderlineField
              id="email"
              label="Work email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.in"
              icon={<Mail size={17} />}
            />
            <UnderlineField
              id="password"
              label="Password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="-mr-1.5 rounded-full p-1.5 text-ink-3 hover:bg-surface-2 hover:text-accent"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              }
            />
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setForgot((v) => !v)}
              aria-expanded={forgot}
              aria-controls="forgot-hint"
              className="rounded-full px-1 text-[12.5px] font-medium text-accent hover:underline"
            >
              Forgot password?
            </button>
          </div>
          {forgot && (
            <p id="forgot-hint" className="mt-2 rounded-[16px] bg-accent-wash px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
              Passwords are managed by your organisation. Ask an admin or owner to set a new one for you from Settings → Team.
            </p>
          )}
          <div className="mt-4">
            <InlineError error={error} />
          </div>
        </div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={busy}
          className="absolute bottom-0 left-1/2 w-[min(260px,78%)] -translate-x-1/2"
        >
          Sign in
        </Button>
      </form>

      {sso.data?.enabled && (
        <div className="mt-9">
          <p className="mb-4 flex items-center gap-3 text-[12px] text-ink-3">
            <span className="h-px flex-1 bg-line-strong" aria-hidden="true" /> or <span className="h-px flex-1 bg-line-strong" aria-hidden="true" />
          </p>
          {/* A full browser navigation, not a fetch: the identity provider takes over the page. */}
          <button
            type="button"
            onClick={() => window.location.assign(new URL("/api/auth/sso/start", window.location.origin).href)}
            className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-line-strong/80 bg-surface-grad text-[14px] font-medium text-ink shadow-raised-sm transition-[box-shadow,color] hover:text-accent hover:shadow-raised"
          >
            <KeyRound size={17} className="text-accent" aria-hidden="true" />
            Continue with {sso.data.name}
          </button>
        </div>
      )}

      <div className="mt-9 flex gap-3 rounded-[24px] border border-dashed border-line-strong px-5 py-4 text-[12.5px] text-ink-2">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <p>
          <span className="font-medium text-ink">Exploring?</span> The demo workspace is an NBFC with sample circulars and policies.{" "}
          <button
            type="button"
            className="font-medium text-accent hover:underline"
            onClick={() => {
              setEmail(DEMO.email);
              setPassword(DEMO.password);
            }}
          >
            Fill in demo credentials
          </button>
        </p>
      </div>
      <p className="mt-6 text-center text-[13px] text-ink-2">
        New to Obligraph?{" "}
        <Link href="/register" className="font-medium text-accent hover:underline">
          Create an organisation
        </Link>
      </p>
    </div>
  );
}
