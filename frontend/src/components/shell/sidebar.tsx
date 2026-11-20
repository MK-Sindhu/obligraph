"use client";

import {
  BookOpen,
  CalendarDays,
  FileCheck2,
  FileStack,
  FileText,
  Gauge,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  PieChart,
  ScrollText,
  Settings,
  ShieldCheck,
  SquareKanban,
  Stamp,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Wordmark } from "@/components/brand";
import { CountBadge } from "@/components/ui/badge";
import { NavTile } from "@/components/ui/nav-tile";
import { api, type ApprovalOut } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";

interface NavItem {
  href: string;
  /** Tile label (kept short so it fits under the icon). */
  label: string;
  /** Full name, used as the tooltip when the tile label is abbreviated. */
  title?: string;
  icon: LucideIcon;
  /** Shows the pending-approvals count. */
  badge?: "approvals";
}

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/readiness", label: "Readiness", icon: Gauge },
      { href: "/reports", label: "Reports", title: "Board pack and exports", icon: PieChart },
    ],
  },
  {
    label: "Regulatory corpus",
    items: [
      { href: "/regulations", label: "Regulations", icon: ScrollText },
      { href: "/graph", label: "Graph", title: "Knowledge graph", icon: Waypoints },
      { href: "/copilot", label: "Copilot", icon: MessageSquareText },
    ],
  },
  {
    label: "Our compliance",
    items: [
      { href: "/obligations", label: "Obligations", icon: ListChecks },
      { href: "/tasks", label: "Tasks", icon: SquareKanban },
      { href: "/approvals", label: "Approvals", icon: Stamp, badge: "approvals" },
      { href: "/filings", label: "Filings", icon: FileStack },
      { href: "/policies", label: "Policies", icon: FileText },
      { href: "/evidence", label: "Evidence", icon: FileCheck2 },
    ],
  },
];

/** Requests waiting for the signed-in user to decide (the Approvals inbox), refreshed every minute. */
export function usePendingApprovals(): number {
  const q = useQuery<ApprovalOut[]>("approvals:inbox", (signal) => api.approvals.list({ inbox: true, limit: 200 }, { signal }));
  const { reload } = q;
  useEffect(() => {
    const id = window.setInterval(reload, 60_000);
    return () => window.clearInterval(id);
  }, [reload]);
  return (q.data ?? []).filter((a) => a.status === "pending").length;
}

function Tile({ item, onNavigate, count }: { item: NavItem; onNavigate?: () => void; count?: number }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  return (
    <NavTile
      href={item.href}
      onClick={onNavigate}
      active={active}
      title={item.title}
      icon={<Icon size={22} strokeWidth={1.6} />}
      badge={count ? <CountBadge count={count} /> : undefined}
      label={
        <>
          {item.label}
          {item.title && <span className="sr-only"> ({item.title})</span>}
          {count ? <span className="sr-only">, {count} waiting for you</span> : null}
        </>
      }
    />
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { isSuperuser } = useAuth();
  const pending = usePendingApprovals();
  const footer: NavItem[] = [
    { href: "/settings", label: "Settings", icon: Settings },
    ...(isSuperuser ? [{ href: "/admin", label: "Admin", title: "Platform admin", icon: ShieldCheck }] : []),
    { href: "/docs", label: "Docs", title: "Documentation", icon: BookOpen },
  ];
  return (
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className="flex h-[76px] shrink-0 items-center px-5">
        <Link href="/dashboard" onClick={onNavigate} aria-label="Obligraph dashboard" className="rounded-[12px]">
          <Wordmark />
        </Link>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-4 pt-1">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <p className="mb-1.5 px-2 text-[10.5px] font-extrabold uppercase tracking-[0.09em] text-accent-deep">{g.label}</p>
            <div className="grid grid-cols-3 gap-x-1 gap-y-2">
              {g.items.map((item) => (
                <Tile key={item.href} item={item} onNavigate={onNavigate} count={item.badge === "approvals" ? pending : undefined} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid shrink-0 grid-cols-3 gap-x-1 border-t border-white/40 px-3 pb-4 pt-3">
        {footer.map((item) => (
          <Tile key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </div>
    </nav>
  );
}
