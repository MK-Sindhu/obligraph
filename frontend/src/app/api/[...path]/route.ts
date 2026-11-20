// Same-origin proxy to the Obligraph FastAPI backend.
// Forwards method, headers and body (JSON or multipart) and streams the upstream body back
// without buffering, so Server-Sent Events from /api/copilot/chat arrive token by token.

import type { NextRequest } from "next/server";

// Headers that describe a single hop and must not be forwarded.
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

/** Read at request time so one image can be pointed at any backend via the environment. */
function upstreamBase(): string {
  const base = process.env.OBLIGRAPH_API_URL ?? "http://localhost:8010";
  return base.replace(/\/+$/, "");
}

async function proxy(req: NextRequest, ctx: RouteContext<"/api/[...path]">): Promise<Response> {
  const { path } = await ctx.params;
  const search = req.nextUrl.search;
  const target = `${upstreamBase()}/api/${path.map(encodeURIComponent).join("/")}${search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  // Ask for an uncompressed body: we pass bytes straight through and never re-encode.
  headers.set("accept-encoding", "identity");

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
    cache: "no-store",
    signal: req.signal,
  };
  if (hasBody && req.body) {
    // The request body (JSON or multipart, bytes untouched) is buffered rather than streamed:
    // undici turns any 401 answer to a streamed-body request into a network error
    // ("expected non-null body source"), which would hide e.g. "invalid email or password".
    // Uploads are capped at 20 MB by the API, so buffering is cheap. Responses still stream.
    const buf = await req.arrayBuffer();
    if (buf.byteLength) init.body = buf;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    console.error(`[proxy] ${req.method} ${target} failed:`, err);
    return Response.json(
      { detail: "The Obligraph API is not reachable. Check OBLIGRAPH_API_URL and that the API is running." },
      { status: 502 },
    );
  }

  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (HOP_BY_HOP.has(k) || k === "content-encoding") return;
    resHeaders.append(key, value);
  });

  const isStream = (upstream.headers.get("content-type") ?? "").includes("text/event-stream");
  if (isStream) {
    // no-transform stops any compression layer from buffering the event stream.
    resHeaders.set("cache-control", "no-cache, no-transform");
    resHeaders.set("x-accel-buffering", "no");
  }

  const bodyless = upstream.status === 204 || upstream.status === 205 || upstream.status === 304;
  return new Response(bodyless || req.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as HEAD,
  proxy as OPTIONS,
};
