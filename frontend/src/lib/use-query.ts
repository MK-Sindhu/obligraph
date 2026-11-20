"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { isAbort } from "@/lib/api";

export interface QueryState<T> {
  data: T | undefined;
  error: unknown;
  /** True while the request for the current key is in flight. */
  loading: boolean;
  /** True once the current key has resolved at least once (data or error). */
  settled: boolean;
  reload: () => void;
  /** Replace the cached value locally (optimistic updates). */
  setData: (updater: T | ((prev: T | undefined) => T)) => void;
}

interface Result<T> {
  key: string | null;
  data: T | undefined;
  error: unknown;
}

/**
 * Minimal data hook: refetches whenever `key` changes, aborts stale requests,
 * keeps the previous data visible while a new key loads. `key = null` disables it.
 */
export function useQuery<T>(key: string | null, fetcher: (signal: AbortSignal) => Promise<T>): QueryState<T> {
  const [nonce, setNonce] = useState(0);
  const reqKey = key === null ? null : `${key}#${nonce}`;
  const [result, setResult] = useState<Result<T>>({ key: null, data: undefined, error: undefined });

  const run = useEffectEvent((signal: AbortSignal) => fetcher(signal));

  useEffect(() => {
    if (reqKey === null) return;
    const ctrl = new AbortController();
    run(ctrl.signal).then(
      (data) => {
        if (!ctrl.signal.aborted) setResult({ key: reqKey, data, error: undefined });
      },
      (error: unknown) => {
        if (ctrl.signal.aborted || isAbort(error)) return;
        setResult((prev) => ({ key: reqKey, data: prev.data, error }));
      },
    );
    return () => ctrl.abort();
  }, [reqKey]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((updater: T | ((prev: T | undefined) => T)) => {
    setResult((prev) => ({
      ...prev,
      data: typeof updater === "function" ? (updater as (p: T | undefined) => T)(prev.data) : updater,
    }));
  }, []);

  const settled = reqKey !== null && result.key === reqKey;
  return {
    data: result.data,
    error: settled ? result.error : undefined,
    loading: reqKey !== null && !settled,
    settled,
    reload,
    setData,
  };
}
