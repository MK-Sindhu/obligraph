"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { api, ApiError, setUnauthorizedHandler, type AiMode, type MembershipOut, type MeOut, type OrgOut, type Role, type SessionOut, type UserOut } from "@/lib/api";
import { parseSession, sessionStore } from "@/lib/session";
import { useQuery } from "@/lib/use-query";

const RANK: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

export function roleAtLeast(role: Role | undefined, needed: Role): boolean {
  return role !== undefined && RANK[role] >= RANK[needed];
}

/** Persist a fresh session from /auth/login or /auth/register. */
export function storeSession(s: SessionOut) {
  sessionStore.set({ token: s.token, orgId: s.memberships[0]?.org.id ?? null });
}

export function useStoredSession() {
  const raw = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot, sessionStore.getServerSnapshot);
  const session = useMemo(() => (raw === undefined ? undefined : parseSession(raw)), [raw]);
  return { hydrated: raw !== undefined, session };
}

export type AuthPhase = "hydrating" | "signed-out" | "loading" | "error" | "no-org" | "ready";

export interface AuthContextValue {
  phase: AuthPhase;
  error: unknown;
  user: UserOut | null;
  memberships: MembershipOut[];
  org: OrgOut | null;
  role: Role | undefined;
  aiMode: AiMode | undefined;
  isSuperuser: boolean;
  can: (role: Role) => boolean;
  switchOrg: (orgId: string) => void;
  logout: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { hydrated, session } = useStoredSession();
  const token = session?.token ?? null;

  const me = useQuery<MeOut>(token ? `me:${token}` : null, (signal) => api.auth.me({ signal }));

  // Where to go once the session is gone: null = back to login, remembering the current page.
  const exitTo = useRef<string | null>(null);

  // One place handles expired or invalid tokens for every API call.
  useEffect(() => {
    setUnauthorizedHandler(() => sessionStore.set(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  // Signed out (never signed in, token rejected, or signed out): go to the login page.
  useEffect(() => {
    if (!hydrated || token) return;
    const here = window.location.pathname + window.location.search;
    const target = exitTo.current ?? (here && here !== "/" ? `/login?next=${encodeURIComponent(here)}` : "/login");
    exitTo.current = null;
    router.replace(target);
  }, [hydrated, token, router]);

  const memberships = useMemo(() => me.data?.memberships ?? [], [me.data]);
  const current = memberships.find((m) => m.org.id === session?.orgId) ?? memberships[0];

  // Keep the stored org valid (e.g. after being removed from an org).
  useEffect(() => {
    if (current && session && session.orgId !== current.org.id) sessionStore.setOrg(current.org.id);
  }, [current, session]);

  const switchOrg = useCallback((orgId: string) => sessionStore.setOrg(orgId), []);
  const logout = useCallback(() => {
    exitTo.current = "/login";
    sessionStore.set(null);
  }, []);

  let phase: AuthPhase;
  if (!hydrated) phase = "hydrating";
  else if (!token) phase = "signed-out";
  else if (!me.data && me.error && !(me.error instanceof ApiError && me.error.status === 401)) phase = "error";
  else if (!me.data) phase = "loading";
  else if (!current) phase = "no-org";
  // The stored org id is applied to request headers; wait until it matches.
  else if (session?.orgId !== current.org.id) phase = "loading";
  else phase = "ready";

  const role = current?.role;
  const value: AuthContextValue = {
    phase,
    error: me.error,
    user: me.data?.user ?? null,
    memberships,
    org: current?.org ?? null,
    role,
    aiMode: me.data?.ai_mode,
    isSuperuser: !!me.data?.user.is_superuser,
    can: (r: Role) => roleAtLeast(role, r),
    switchOrg,
    logout,
    refresh: me.reload,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
