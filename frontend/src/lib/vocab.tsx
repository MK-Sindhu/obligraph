"use client";

import { createContext, useContext, useMemo } from "react";
import { api, type Vocabulary } from "@/lib/api";
import { useQuery } from "@/lib/use-query";
import { humanize } from "@/lib/format";

interface VocabValue {
  vocab: Vocabulary | undefined;
  loading: boolean;
  error: unknown;
  reload: () => void;
  topic: (key: string) => string;
  entity: (key: string) => string;
  regulator: (key: string) => string;
}

const VocabContext = createContext<VocabValue | null>(null);

export function VocabProvider({ children }: { children: React.ReactNode }) {
  const q = useQuery<Vocabulary>("vocab", (signal) => api.meta.vocabulary({ signal }));
  const value = useMemo<VocabValue>(() => {
    const topics = new Map(q.data?.topics.map((t) => [t.key, t.label]));
    const entities = new Map(q.data?.entity_classes.map((t) => [t.key, t.label]));
    const regulators = new Map(q.data?.regulators.map((t) => [t.key, t.label]));
    return {
      vocab: q.data,
      loading: q.loading,
      error: q.error,
      reload: q.reload,
      topic: (k) => topics.get(k) ?? (k === "general" ? "General" : humanize(k)),
      entity: (k) => entities.get(k) ?? humanize(k),
      regulator: (k) => regulators.get(k) ?? k,
    };
  }, [q.data, q.loading, q.error, q.reload]);
  return <VocabContext.Provider value={value}>{children}</VocabContext.Provider>;
}

export function useVocab(): VocabValue {
  const ctx = useContext(VocabContext);
  if (!ctx) throw new Error("useVocab must be used inside <VocabProvider>");
  return ctx;
}
