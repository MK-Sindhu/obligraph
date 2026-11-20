"use client";

import { ApiError, rawRequest, type Query } from "@/lib/api";

function filenameFrom(disposition: string | null): string | null {
  if (!disposition) return null;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      /* fall through */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1].trim() : null;
}

export interface DownloadResult {
  filename: string;
  /** Content hash from X-Content-SHA256, when the API sends one (evidence downloads). */
  sha256: string | null;
  bytes: number;
}

/**
 * Fetch an authenticated file from the API and hand it to the browser as a download.
 * (A plain link can't carry the bearer token.)
 */
export async function downloadFile(path: string, opts: { query?: Query; filename?: string } = {}): Promise<DownloadResult> {
  const res = await rawRequest(path, { query: opts.query, headers: { Accept: "*/*" } });
  if (!res.ok) {
    let message = `Download failed (${res.status}).`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === "string" && body.detail) message = body.detail[0].toUpperCase() + body.detail.slice(1);
    } catch {
      /* not JSON */
    }
    if (res.status === 403) message = "You don't have permission to download this.";
    throw new ApiError(res.status, message);
  }
  const blob = await res.blob();
  const filename = filenameFrom(res.headers.get("content-disposition")) ?? opts.filename ?? "download";
  saveBlob(blob, filename);
  return { filename, sha256: res.headers.get("x-content-sha256"), bytes: blob.size };
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
