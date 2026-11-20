// Typed endpoint functions. One function per backend operation in openapi.json.

import { ApiError, rawRequest, request, type Query } from "./client";
import type * as T from "./types";

export * from "./client";
export type * from "./types";

type Sig = { signal?: AbortSignal };

export interface RegulationFilters {
  q?: string;
  regulator?: string;
  topic?: string;
  status?: string;
  applies?: boolean;
  limit?: number;
  offset?: number;
}

export interface ObligationFilters {
  coverage?: string;
  status?: string;
  severity?: string;
  regulator?: string;
  topic?: string;
  regulation_id?: string;
  q?: string;
  include_retired?: boolean;
  limit?: number;
  offset?: number;
}

export const api = {
  auth: {
    login: (body: T.LoginIn) =>
      request<T.SessionOut>("/auth/login", { method: "POST", json: body, noAuthRedirect: true }),
    register: (body: T.RegisterIn) =>
      request<T.SessionOut>("/auth/register", { method: "POST", json: body, noAuthRedirect: true }),
    me: (o: Sig = {}) => request<T.MeOut>("/auth/me", o),
    /** Validate a token that isn't stored yet (SSO hand-off). */
    meWithToken: (token: string, o: Sig = {}) =>
      request<T.MeOut>("/auth/me", { ...o, headers: { Authorization: `Bearer ${token}` }, noAuthRedirect: true }),
    sso: (o: Sig = {}) => request<T.SsoConfig>("/auth/sso", { ...o, noAuthRedirect: true }),
  },

  meta: {
    vocabulary: (o: Sig = {}) => request<T.Vocabulary>("/meta/vocabulary", o),
  },

  org: {
    get: (o: Sig = {}) => request<T.OrgOut>("/org", o),
    update: (body: T.OrgUpdate) => request<T.OrgOut>("/org", { method: "PATCH", json: body }),
    members: (o: Sig = {}) => request<T.MemberOut[]>("/org/members", o),
    addMember: (body: T.MemberCreate) =>
      request<T.MemberOut>("/org/members", { method: "POST", json: body }),
    updateMember: (userId: string, role: T.Role) =>
      request<T.MemberOut>(`/org/members/${userId}`, { method: "PATCH", json: { role } }),
    removeMember: (userId: string) => request<void>(`/org/members/${userId}`, { method: "DELETE" }),
    activity: (limit = 100, o: Sig = {}) =>
      request<T.ActivityOut[]>("/org/activity", { ...o, query: { limit } }),
  },

  regulations: {
    list: (f: RegulationFilters = {}, o: Sig = {}) =>
      request<T.Page<T.RegulationSummary>>("/regulations", {
        ...o,
        query: { ...f, applies: f.applies ? true : undefined } as Query,
      }),
    get: (id: string, o: Sig = {}) => request<T.RegulationDetail>(`/regulations/${id}`, o),
    ingestText: (body: T.IngestText) =>
      request<T.IngestResult>("/regulations/ingest", { method: "POST", json: body }),
    upload: (file: File, regulator: string, title?: string) => {
      const form = new FormData();
      form.set("file", file);
      form.set("regulator", regulator);
      if (title) form.set("title", title);
      return request<T.IngestResult>("/regulations/upload", { method: "POST", form });
    },
  },

  graph: {
    overview: (f: { topic?: string; mine?: boolean; limit?: number } = {}, o: Sig = {}) =>
      request<T.Subgraph>("/graph", { ...o, query: { ...f, mine: f.mine ? true : undefined } }),
    node: (id: string, o: Sig = {}) => request<T.Subgraph>(`/graph/nodes/${id}`, o),
    inForce: (on: string, topic?: string, o: Sig = {}) =>
      request<T.InForceRow[]>("/graph/in-force", { ...o, query: { on, topic } }),
    stats: (o: Sig = {}) => request<T.GraphStats>("/graph/stats", o),
  },

  search: (q: string, scope: "regulations" | "policies" = "regulations", o: Sig = {}) =>
    request<T.SearchHitOut[]>("/search", { ...o, query: { q, scope } }),

  policies: {
    list: (o: Sig = {}) => request<T.PolicyOut[]>("/policies", o),
    upload: (file: File, title?: string) => {
      const form = new FormData();
      form.set("file", file);
      if (title) form.set("title", title);
      return request<T.PolicyOut>("/policies", { method: "POST", form });
    },
    remove: (id: string) => request<void>(`/policies/${id}`, { method: "DELETE" }),
  },

  obligations: {
    list: (f: ObligationFilters = {}, o: Sig = {}) =>
      request<T.Page<T.ObligationOut>>("/obligations", { ...o, query: f as Query }),
    get: (id: string, o: Sig = {}) => request<T.ObligationOut>(`/obligations/${id}`, o),
    update: (id: string, body: T.ObligationUpdate) =>
      request<T.ObligationOut>(`/obligations/${id}`, { method: "PATCH", json: body }),
    assess: (id: string) =>
      request<{ queued: boolean }>(`/obligations/${id}/assess`, { method: "POST" }),
    assessAll: () => request<{ queued: boolean }>("/obligations/assess-all", { method: "POST" }),
  },

  tasks: {
    list: (
      f: { status?: string; obligation_id?: string; assignee_id?: string; limit?: number } = {},
      o: Sig = {},
    ) => request<T.TaskOut[]>("/tasks", { ...o, query: f }),
    create: (body: T.TaskCreate) => request<T.TaskOut>("/tasks", { method: "POST", json: body }),
    update: (id: string, body: T.TaskUpdate) =>
      request<T.TaskOut>(`/tasks/${id}`, { method: "PATCH", json: body }),
    remove: (id: string) => request<void>(`/tasks/${id}`, { method: "DELETE" }),
    submit: (id: string, body: T.SubmitIn) =>
      request<T.ApprovalOut>(`/tasks/${id}/submit`, { method: "POST", json: body }),
  },

  evidence: {
    list: (f: T.EvidenceLink & { limit?: number } = {}, o: Sig = {}) =>
      request<T.EvidenceOut[]>("/evidence", { ...o, query: f as Query }),
    upload: (file: File, link: T.EvidenceLink = {}, note?: string) => {
      const form = new FormData();
      form.set("file", file);
      if (link.task_id) form.set("task_id", link.task_id);
      if (link.obligation_id) form.set("obligation_id", link.obligation_id);
      if (link.filing_id) form.set("filing_id", link.filing_id);
      if (note) form.set("note", note);
      return request<T.EvidenceOut>("/evidence", { method: "POST", form });
    },
    downloadPath: (id: string) => `/evidence/${id}/download`,
    remove: (id: string) => request<void>(`/evidence/${id}`, { method: "DELETE" }),
  },

  approvals: {
    list: (f: { status?: string; inbox?: boolean; task_id?: string; limit?: number } = {}, o: Sig = {}) =>
      request<T.ApprovalOut[]>("/approvals", { ...o, query: { ...f, inbox: f.inbox ? true : undefined } }),
    get: (id: string, o: Sig = {}) => request<T.ApprovalOut>(`/approvals/${id}`, o),
    decide: (id: string, action: T.ApprovalAction, note = "") =>
      request<T.ApprovalOut>(`/approvals/${id}/${action}`, { method: "POST", json: { note } }),
  },

  returns: {
    list: (o: Sig = {}) => request<T.ReturnTypeOut[]>("/returns", o),
    create: (body: T.ReturnTypeIn) => request<T.ReturnTypeOut>("/returns", { method: "POST", json: body }),
    update: (id: string, body: T.ReturnTypeUpdate) =>
      request<T.ReturnTypeOut>(`/returns/${id}`, { method: "PATCH", json: body }),
  },

  filings: {
    list: (f: { start?: string; end?: string; status?: string } = {}, o: Sig = {}) =>
      request<T.FilingOut[]>("/filings", { ...o, query: f }),
    file: (id: string, body: T.FileIn) =>
      request<T.FilingOut>(`/filings/${id}/file`, { method: "POST", json: body }),
    waive: (id: string, note: string) =>
      request<T.FilingOut>(`/filings/${id}/waive`, { method: "POST", json: { note } }),
    reopen: (id: string) => request<T.FilingOut>(`/filings/${id}/reopen`, { method: "POST" }),
  },

  packs: {
    list: (o: Sig = {}) => request<T.PackSummary[]>("/packs", o),
    get: (key: string, o: Sig = {}) => request<T.PackDetail>(`/packs/${encodeURIComponent(key)}`, o),
  },

  sbr: (target?: string, o: Sig = {}) => request<T.SbrOut>("/sbr", { ...o, query: { target } }),

  reports: {
    boardPack: (f: { start?: string; end?: string } = {}, o: Sig = {}) =>
      request<T.BoardPack>("/reports/board-pack", { ...o, query: f }),
    /** Printable HTML of the board pack, fetched with auth. */
    boardPackHtml: async (f: { start?: string; end?: string } = {}) => {
      const res = await rawRequest("/reports/board-pack.html", { query: f, headers: { Accept: "text/html" } });
      const text = await res.text();
      if (!res.ok) throw new ApiError(res.status, `Couldn't build the printable board pack (${res.status}).`);
      return text;
    },
  },

  dashboard: (o: Sig = {}) => request<T.Dashboard>("/dashboard", o),

  calendar: (start: string, end: string, o: Sig = {}) =>
    request<T.CalendarEvent[]>("/calendar", { ...o, query: { start, end } }),

  alerts: {
    list: (f: { unread?: boolean; limit?: number } = {}, o: Sig = {}) =>
      request<T.AlertOut[]>("/alerts", { ...o, query: { ...f, unread: f.unread ? true : undefined } }),
    read: (id: string) => request<void>(`/alerts/${id}/read`, { method: "POST" }),
    readAll: () => request<void>("/alerts/read-all", { method: "POST" }),
  },

  copilot: {
    conversations: (o: Sig = {}) => request<T.ConversationOut[]>("/copilot/conversations", o),
    conversation: (id: string, o: Sig = {}) =>
      request<T.ConversationDetail>(`/copilot/conversations/${id}`, o),
    remove: (id: string) => request<void>(`/copilot/conversations/${id}`, { method: "DELETE" }),
    chat: streamChat,
  },

  admin: {
    overview: (o: Sig = {}) => request<T.AdminOverview>("/admin/overview", o),
    sources: (o: Sig = {}) => request<T.SourceOut[]>("/admin/sources", o),
    runSource: (key: string) =>
      request<{ queued: boolean }>(`/admin/sources/${encodeURIComponent(key)}/run`, { method: "POST" }),
    toggleSource: (key: string, enabled: boolean) =>
      request<T.SourceOut>(`/admin/sources/${encodeURIComponent(key)}`, {
        method: "PATCH",
        query: { enabled },
      }),
    jobs: (status?: string, o: Sig = {}) =>
      request<T.JobOut[]>("/admin/jobs", { ...o, query: { status_filter: status } }),
  },
};

/**
 * POST /api/copilot/chat and yield each Server-Sent Event as it arrives.
 * The stream is parsed incrementally; nothing is buffered beyond one event.
 */
async function* streamChat(body: T.ChatIn, signal?: AbortSignal): AsyncGenerator<T.CopilotEvent> {
  const res = await rawRequest("/copilot/chat", {
    method: "POST",
    json: body,
    signal,
    headers: { Accept: "text/event-stream" },
  });
  if (!res.ok || !res.body) {
    let detail = `Copilot request failed (${res.status}).`;
    try {
      const j = (await res.json()) as { detail?: unknown };
      if (typeof j.detail === "string") detail = j.detail;
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, detail);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let idx: number;
      // Events are separated by a blank line; tolerate CRLF.
      while ((idx = buf.search(/\r?\n\r?\n/)) !== -1) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx).replace(/^\r?\n\r?\n/, "");
        const data = raw
          .split(/\r?\n/)
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).replace(/^ /, ""))
          .join("\n");
        if (!data) continue;
        try {
          yield JSON.parse(data) as T.CopilotEvent;
        } catch {
          // Ignore malformed frames rather than killing the stream.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
