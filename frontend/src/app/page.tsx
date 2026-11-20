"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Splash } from "@/components/brand";
import { useStoredSession } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  const { hydrated, session } = useStoredSession();
  useEffect(() => {
    if (hydrated) router.replace(session ? "/dashboard" : "/login");
  }, [hydrated, session, router]);
  return <Splash label="Loading…" />;
}
