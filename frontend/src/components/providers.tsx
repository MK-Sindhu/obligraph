"use client";

import { ToastProvider } from "@/components/ui/toast";
import { VocabProvider } from "@/lib/vocab";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <VocabProvider>{children}</VocabProvider>
    </ToastProvider>
  );
}
