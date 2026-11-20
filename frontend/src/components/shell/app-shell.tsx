"use client";

import { Building2, LogOut, RotateCw } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoMark, Splash } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[272px] max-w-[85vw] rounded-r-[30px] border-r border-[var(--card-edge)] bg-canvas p-0 shadow-pop open:animate-[rise-in_160ms_ease-out] lg:hidden"
    >
      {open && <Sidebar onNavigate={onClose} />}
    </dialog>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { org } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const fullBleed = pathname.startsWith("/copilot") || pathname.startsWith("/graph");

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 bg-canvas lg:block">
        <Sidebar />
      </aside>
      <MobileNav open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setNavOpen(true)} />
        {/* Remount pages when the organisation changes so every query refetches for it. */}
        <main
          key={org?.id}
          id="main"
          className={fullBleed ? "flex min-h-0 flex-1 flex-col" : "mx-auto w-full max-w-[1360px] flex-1 px-4 pb-20 pt-4 sm:px-8"}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  switch (auth.phase) {
    case "hydrating":
    case "signed-out":
    case "loading":
      return <Splash />;
    case "error":
      return (
        <div className="flex min-h-dvh items-center justify-center px-4">
          <div className="flex w-full max-w-[480px] flex-col items-center gap-3 rounded-card-lg soft px-8 py-10 text-center">
          <LogoMark size={40} />
          <p className="display mt-2 text-[20px]">Obligraph can&rsquo;t reach its API</p>
          <p className="max-w-md text-[13.5px] text-ink-2">{errorMessage(auth.error)}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" icon={<RotateCw size={14} />} onClick={auth.refresh}>
              Try again
            </Button>
            <Button variant="ghost" icon={<LogOut size={14} />} onClick={auth.logout}>
              Sign out
            </Button>
          </div>
          </div>
        </div>
      );
    case "no-org":
      return (
        <div className="flex min-h-dvh items-center justify-center px-4">
          <div className="flex w-full max-w-[480px] flex-col items-center gap-3 rounded-card-lg soft px-8 py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-[18px] soft-sm text-accent">
            <Building2 size={24} />
          </span>
          <p className="display mt-2 text-[20px]">You&rsquo;re not in an organisation yet</p>
          <p className="max-w-md text-[13.5px] text-ink-2">
            Ask an admin of your organisation to add {auth.user?.email ?? "you"} from Settings → Team, then sign in again.
          </p>
          <Button variant="secondary" className="mt-2" icon={<LogOut size={14} />} onClick={auth.logout}>
            Sign out
          </Button>
          </div>
        </div>
      );
    case "ready":
      return <Shell>{children}</Shell>;
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Gate>{children}</Gate>
    </AuthProvider>
  );
}
