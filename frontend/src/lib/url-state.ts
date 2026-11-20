"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Query-string backed UI state (filters, selected record, open dialog).
 * `set({ a: "1", b: null })` merges into the URL; null/"" removes a key.
 * Components using this must sit inside a <Suspense> boundary.
 */
export function useUrlState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const set = useCallback(
    (patch: Record<string, string | number | null | undefined>, opts: { push?: boolean } = {}) => {
      const next = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (opts.push) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [router, pathname],
  );

  const get = useCallback((k: string) => params.get(k) ?? "", [params]);

  return { params, get, set };
}
