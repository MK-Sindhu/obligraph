"use client";

import { useMemo } from "react";
import { api, type MemberOut } from "@/lib/api";
import { useQuery } from "@/lib/use-query";

/** Members of the current organisation, plus an id → member lookup. */
export function useMembers() {
  const q = useQuery<MemberOut[]>("org:members", (signal) => api.org.members({ signal }));
  const byId = useMemo(() => new Map((q.data ?? []).map((m) => [m.user.id, m])), [q.data]);
  return { ...q, members: q.data ?? [], byId };
}
