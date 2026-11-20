// Browser session: bearer token + selected organisation, persisted in localStorage.
// Exposed as an external store so React reads it with useSyncExternalStore.

const KEY = "obligraph.session";

export interface StoredSession {
  token: string;
  orgId: string | null;
}

const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function emit() {
  for (const l of listeners) l();
}

export function parseSession(raw: string | null | undefined): StoredSession | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredSession>;
    return typeof v.token === "string" && v.token ? { token: v.token, orgId: v.orgId ?? null } : null;
  } catch {
    return null;
  }
}

export const sessionStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
  /** Raw string so the snapshot is referentially stable between renders. */
  getSnapshot(): string | null {
    return read();
  },
  /** `undefined` on the server means "not hydrated yet", distinct from "signed out". */
  getServerSnapshot(): string | null | undefined {
    return undefined;
  },
  get(): StoredSession | null {
    return parseSession(read());
  },
  set(session: StoredSession | null) {
    try {
      if (session) window.localStorage.setItem(KEY, JSON.stringify(session));
      else window.localStorage.removeItem(KEY);
    } catch {
      // Storage unavailable (private mode); the session lives only for this page.
    }
    emit();
  },
  setOrg(orgId: string) {
    const s = parseSession(read());
    if (s) this.set({ ...s, orgId });
  },
};
