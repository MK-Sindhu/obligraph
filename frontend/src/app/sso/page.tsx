"use client";

import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { LogoMark, Splash } from "@/components/brand";
import { api, errorMessage } from "@/lib/api";
import { storeSession } from "@/lib/auth";

// The fragment is captured once: the page removes it from the address bar right away,
// and effects run twice in development.
let captured: string | null = null;
const noop = () => () => {};
function hashSnapshot(): string {
  if (captured === null) captured = window.location.hash.replace(/^#/, "");
  return captured;
}

/** Parse `token=…` or `error=…` from the fragment the API's SSO callback redirected to. */
function parseFragment(hash: string): { token: string | null; error: string | null } {
  const p = new URLSearchParams(hash);
  return { token: p.get("token"), error: p.get("error") ?? p.get("error_description") };
}

const ERROR_TEXT: Record<string, string> = {
  access_denied: "The sign-in was cancelled at your identity provider.",
  no_account: "There's no Obligraph account for that email. Ask an admin to add you from Settings → Team.",
  domain_not_allowed: "Your email domain isn't allowed to sign in with single sign-on here.",
  invalid_state: "The sign-in link expired or was already used. Start again from the sign-in page.",
};

/**
 * Single sign-on hand-off. The token arrives in the URL fragment (never sent to a server),
 * is checked against /auth/me, then stored exactly as a password sign-in stores it.
 */
export default function SsoPage() {
  const router = useRouter();
  // null on the server and during hydration; the captured fragment afterwards.
  const hash = useSyncExternalStore(noop, hashSnapshot, () => null);
  const [failure, setFailure] = useState<string | null>(null);
  const { token, error: err } = parseFragment(hash ?? "");
  const error =
    failure ??
    (hash === null
      ? null
      : err
        ? (ERROR_TEXT[err] ?? err.replace(/[_+]/g, " "))
        : !token
          ? "The single sign-on response didn't include a session. Start again from the sign-in page."
          : null);

  useEffect(() => {
    // Drop the token from the address bar and history straight away.
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    if (!token || err) return;
    const ctrl = new AbortController();
    api.auth.meWithToken(token, { signal: ctrl.signal }).then(
      (me) => {
        storeSession({ token, user: me.user, memberships: me.memberships });
        router.replace("/dashboard");
      },
      (e: unknown) => {
        if (!ctrl.signal.aborted) setFailure(`Obligraph couldn't confirm your session: ${errorMessage(e)}`);
      },
    );
    return () => ctrl.abort();
  }, [router, token, err]);

  if (!error) return <Splash label="Signing you in…" />;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <title>Sign-in failed · Obligraph</title>
      <div role="alert" className="flex w-full max-w-[460px] flex-col items-center gap-3 rounded-card-lg soft px-8 py-10 text-center">
        <LogoMark size={40} />
        <span className="mt-3 flex h-12 w-12 items-center justify-center rounded-[16px] bg-danger-bg text-danger">
          <ShieldAlert size={22} aria-hidden="true" />
        </span>
        <h1 className="display text-[22px]">Single sign-on didn&rsquo;t work</h1>
        <p className="max-w-sm text-[13.5px] leading-relaxed text-ink-2">{error}</p>
        <Link
          href="/login"
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-accent-grad-text px-6 text-[13.5px] font-medium text-white shadow-glow"
        >
          <ArrowLeft size={15} aria-hidden="true" /> Back to sign in
        </Link>
      </div>
    </div>
  );
}
