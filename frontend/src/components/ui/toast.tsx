"use client";

import clsx from "clsx";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type Tone = "success" | "error" | "info";
interface Toast {
  id: number;
  tone: Tone;
  title: string;
  body?: string;
}

interface ToastApi {
  toast: (t: { title: string; body?: string; tone?: Tone }) => void;
  success: (title: string, body?: string) => void;
  error: (title: string, body?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    ({ title, body, tone = "info" }: { title: string; body?: string; tone?: Tone }) => {
      const id = ++seq.current;
      setToasts((ts) => [...ts.slice(-3), { id, tone, title, body }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4200);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (title, body) => toast({ title, body, tone: "success" }),
      error: (title, body) => toast({ title, body, tone: "error" }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className="pointer-events-auto flex animate-[rise-in_160ms_ease-out] items-start gap-3 rounded-[22px] border border-[var(--card-edge)] bg-surface-grad px-4 py-3.5 shadow-pop"
          >
            {t.tone === "success" && <CheckCircle2 size={17} className="mt-px shrink-0 text-ok" aria-hidden="true" />}
            {t.tone === "error" && <XCircle size={17} className="mt-px shrink-0 text-danger" aria-hidden="true" />}
            {t.tone === "info" && <Info size={17} className="mt-px shrink-0 text-accent" aria-hidden="true" />}
            <div className="min-w-0 flex-1">
              <p className={clsx("text-[13.5px] font-medium")}>{t.title}</p>
              {t.body && <p className="mt-0.5 text-[12.5px] text-ink-2">{t.body}</p>}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="-m-1 rounded-full p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
