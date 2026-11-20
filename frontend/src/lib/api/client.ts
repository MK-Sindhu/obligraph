// Low-level HTTP client for the same-origin /api proxy.
// Adds Authorization + X-Org-Id, normalises errors, and routes 401s to one handler.

import { sessionStore } from "@/lib/session";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/** Registered once by the AuthProvider: clears the session and redirects to /login. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

export type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Query;
  json?: unknown;
  form?: FormData;
  signal?: AbortSignal;
  /** Skip the global 401 redirect (used by the login form itself). */
  noAuthRedirect?: boolean;
  headers?: Record<string, string>;
}

export function buildUrl(path: string, query?: Query): string {
  const qs = new URLSearchParams();
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      qs.set(k, String(v));
    }
  }
  const s = qs.toString();
  return `/api${path}${s ? `?${s}` : ""}`;
}

function messageFrom(status: number, body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail;
    // Backend details are lower-case fragments ("invalid email or password"); show as sentences.
    if (typeof d === "string") return d ? d[0].toUpperCase() + d.slice(1) : d;
    if (Array.isArray(d) && d.length) {
      // FastAPI validation errors: [{loc, msg}]
      return d
        .map((e: { loc?: unknown[]; msg?: string }) => {
          const field = Array.isArray(e.loc) ? e.loc.filter((p) => p !== "body").join(".") : "";
          return field ? `${field}: ${e.msg}` : (e.msg ?? "invalid");
        })
        .join("; ");
    }
  }
  if (status === 502 || status === 503 || status === 504) return "The Obligraph API is not reachable.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "Not found.";
  return `Request failed (${status}).`;
}

export function authHeaders(): Record<string, string> {
  const s = sessionStore.get();
  const h: Record<string, string> = {};
  if (s?.token) h.Authorization = `Bearer ${s.token}`;
  if (s?.orgId) h["X-Org-Id"] = s.orgId;
  return h;
}

/** Raw fetch with auth headers and central 401 handling; caller owns the body. */
export async function rawRequest(path: string, opts: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json", ...authHeaders(), ...opts.headers };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  }
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? "GET",
      headers,
      body,
      signal: opts.signal,
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "Network error: could not reach Obligraph.");
  }
  if (res.status === 401 && !opts.noAuthRedirect) {
    onUnauthorized?.();
  }
  return res;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await rawRequest(path, opts);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) throw new ApiError(res.status, messageFrom(res.status, body), body);
  return body as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

export function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
