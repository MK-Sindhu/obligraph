"use client";

// Serverless hosts (Vercel) have no background worker. Work that a request could not
// finish in its own time budget (gap assessment after a policy upload, extraction of a
// new circular) waits in the job queue. While someone is signed in, this component
// advances it in short, time-boxed steps via POST /api/jobs/drain. On Docker deployments
// the API reports serverless=false and this renders nothing.

import { useEffect, useRef, useState } from "react";

import { request } from "@/lib/api";

interface Runtime {
  serverless: boolean;
}
interface JobStatus {
  pending: number;
}
interface DrainResult {
  processed: number;
  pending: number;
  busy: boolean;
}

const IDLE_POLL_MS = 30_000;
const BUSY_POLL_MS = 3_000;

export function JobRunner() {
  const [pending, setPending] = useState(0);
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (ms: number, fn: () => void) => {
      if (!stopped.current) timer = setTimeout(fn, ms);
    };

    const tick = async () => {
      if (stopped.current) return;
      try {
        const status = await request<JobStatus>("/jobs/status");
        if (status.pending > 0 && document.visibilityState === "visible") {
          const res = await request<DrainResult>("/jobs/drain", { method: "POST" });
          setPending(res.pending);
          schedule(res.pending > 0 ? BUSY_POLL_MS : IDLE_POLL_MS, tick);
          return;
        }
        setPending(status.pending);
      } catch {
        // Rate-limited or offline: back off quietly and try again later.
      }
      schedule(IDLE_POLL_MS, tick);
    };

    (async () => {
      try {
        const runtime = await request<Runtime>("/meta/runtime");
        if (runtime.serverless) await tick();
      } catch {
        // No runtime info: assume a server with its own worker.
      }
    })();

    return () => {
      stopped.current = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (pending <= 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="card fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[var(--ink-2)]"
    >
      <span
        aria-hidden
        className="size-2 rounded-full bg-[var(--accent)] motion-safe:animate-pulse"
      />
      Processing {pending} item{pending === 1 ? "" : "s"}…
    </div>
  );
}
