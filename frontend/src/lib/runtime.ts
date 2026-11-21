"use client";

import { request } from "@/lib/api";
import { useQuery } from "@/lib/use-query";

export interface Runtime {
  serverless: boolean;
  /** Largest upload the API accepts (policies, evidence, regulation files). */
  upload_limit_mb: number;
  ai_mode: "claude" | "offline";
  /** The demo account exists (SEED_DEMO or `obligraph seed --demo`), so its login works. */
  demo: boolean;
}

/** Deployment facts from GET /api/meta/runtime (cached per session). */
export function useRuntime() {
  return useQuery<Runtime>("meta:runtime", (signal) => request<Runtime>("/meta/runtime", { signal, noAuthRedirect: true }));
}

/** The API's upload limit in MB; 25 (the default on Docker) until the runtime loads. */
export function useUploadLimitMb(): number {
  return useRuntime().data?.upload_limit_mb ?? 25;
}
