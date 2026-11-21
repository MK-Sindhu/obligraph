"use client";

import clsx from "clsx";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonClass } from "@/components/ui/styles";
import { useStoredSession } from "@/lib/auth";

export const MARKETING_NAV = [
  { href: "/product", label: "Product" },
  { href: "/solutions", label: "Solutions" },
  { href: "/security", label: "Security" },
  { href: "/docs", label: "Docs" },
  { href: "/contact", label: "Contact" },
];

/** "Sign in" for visitors, "Open app" once there's a stored session. */
function AuthLink({ className, onClick }: { className?: string; onClick?: () => void }) {
  const { hydrated, session } = useStoredSession();
  const signedIn = hydrated && !!session;
  return (
    <Link href={signedIn ? "/dashboard" : "/login"} onClick={onClick} className={className}>
      {signedIn ? "Open app" : "Sign in"}
    </Link>
  );
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
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
      aria-label="Site menu"
      className="overlay fixed inset-x-3 top-3 m-0 w-auto max-w-none rounded-[28px] p-0 text-ink open:animate-[rise-in_160ms_ease-out] md:hidden"
    >
      {open && (
        <div className="px-5 pb-6 pt-4">
          <div className="flex items-center justify-between">
            <Wordmark size={26} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-line-strong/70 bg-surface text-ink-2 shadow-xs"
            >
              <X size={18} />
            </button>
          </div>
          <nav aria-label="Site" className="mt-5">
            <ul className="space-y-1">
              {MARKETING_NAV.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={onClose}
                    aria-current={pathname === l.href || pathname.startsWith(`${l.href}/`) ? "page" : undefined}
                    className={clsx(
                      "flex h-12 items-center rounded-[14px] px-4 text-[15px] font-semibold",
                      pathname === l.href || pathname.startsWith(`${l.href}/`) ? "bg-accent-wash text-accent" : "text-ink hover:bg-surface-2",
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-5 grid gap-3">
            <Link href="/contact" onClick={onClose} className={buttonClass("primary", "lg", "w-full")}>
              Request a demo
            </Link>
            <AuthLink onClick={onClose} className={buttonClass("secondary", "lg", "w-full")} />
          </div>
        </div>
      )}
    </dialog>
  );
}

/** Floating white navigation bar for the public site. */
export function MarketingNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
      <div className="card mx-auto flex h-16 max-w-[1240px] items-center gap-3 rounded-[20px] pl-5 pr-2.5">
        <Link href="/" aria-label="Obligraph home" className="shrink-0 rounded-[12px]">
          <Wordmark size={28} />
        </Link>
        <nav aria-label="Site" className="ml-6 hidden md:block">
          <ul className="flex items-center gap-1">
            {MARKETING_NAV.map((l) => {
              const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "inline-flex h-9 items-center rounded-[10px] px-3 text-[13.5px] font-semibold transition-colors",
                      active ? "bg-accent-wash text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <span className="flex-1" />
        <ThemeToggle className="mr-1 inline-flex" />
        <AuthLink className="hidden h-9 items-center rounded-[10px] px-3 text-[13.5px] font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink sm:inline-flex" />
        <Link href="/contact" className={buttonClass("primary", "md", "hidden! uppercase tracking-[0.05em] sm:inline-flex!")}>
          Request a demo
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink-2 md:hidden"
        >
          <Menu size={19} />
        </button>
      </div>
      <MobileMenu open={open} onClose={() => setOpen(false)} />
    </header>
  );
}
