"use client";

import clsx from "clsx";
import { Bell, Building2, Check, ChevronsUpDown, LogOut, Menu, Monitor, Moon, Sparkles, Sun, Unplug } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SeverityGlyph } from "@/components/domain/badges";
import { CountBadge } from "@/components/ui/badge";
import { IconButton, iconTileClass } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { SegmentedControl } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { MenuItem, Popover } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, type AlertOut } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { humanize, relativeTime } from "@/lib/format";
import { setThemePref, useResolvedTheme, useThemePref, type ThemePref } from "@/lib/theme";
import { useQuery } from "@/lib/use-query";
import { useVocab } from "@/lib/vocab";

function OrgSwitcher() {
  const { org, memberships, role, switchOrg } = useAuth();
  const { entity } = useVocab();
  if (!org) return null;
  return (
    <Popover
      align="start"
      className="min-w-0"
      trigger={(p) => (
        <button
          type="button"
          onClick={p.toggle}
          aria-expanded={p["aria-expanded"]}
          aria-haspopup="menu"
          className="flex min-w-0 max-w-[360px] items-center gap-3 rounded-full border border-[var(--card-edge)] bg-surface-grad py-1.5 pl-1.5 pr-4 text-left shadow-raised-xs transition-shadow hover:shadow-raised-sm"
        >
          <span className={iconTileClass("accent", "sm", "rounded-full!")}>
            <Building2 size={15} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-medium leading-tight">{org.name}</span>
            <span className="block truncate text-[11.5px] leading-tight text-ink-3">
              {org.entity_classes.map(entity).join(", ") || "No entity type set"} · {role && humanize(role)}
            </span>
          </span>
          <ChevronsUpDown size={14} className="shrink-0 text-ink-3" aria-hidden="true" />
        </button>
      )}
      panelClassName="w-72"
    >
      {(close) => (
        <div role="menu">
          <p className="eyebrow px-3 pb-1.5 pt-2">Your organisations</p>
          {memberships.map((m) => (
            <MenuItem
              key={m.org.id}
              active={m.org.id === org.id}
              onClick={() => {
                close();
                if (m.org.id !== org.id) switchOrg(m.org.id);
              }}
              icon={m.org.id === org.id ? <Check size={14} className="text-accent" /> : <span className="inline-block w-3.5" />}
            >
              <span className="block truncate">{m.org.name}</span>
              <span className="block text-[11.5px] text-ink-3">{humanize(m.role)}</span>
            </MenuItem>
          ))}
          <div className="mx-2 my-1.5 border-t border-line" />
          <Link href="/settings" onClick={close} className="block rounded-[14px] px-3 py-2.5 text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink">
            Organisation settings
          </Link>
        </div>
      )}
    </Popover>
  );
}

function AiBadge() {
  const { aiMode } = useAuth();
  if (!aiMode) return null;
  const claude = aiMode === "claude";
  return (
    <span
      className={clsx(
        "hidden h-9 items-center gap-1.5 rounded-full border px-3.5 text-[12px] font-medium md:inline-flex",
        claude ? "border-accent/25 bg-accent-wash text-accent" : "border-line-strong text-ink-2",
      )}
      title={
        claude
          ? "Assessments, extraction and Copilot answers use Claude."
          : "Claude isn't configured. Assessments use offline heuristics and Copilot shows retrieved sources instead of written answers."
      }
    >
      {claude ? <Sparkles size={12} aria-hidden="true" /> : <Unplug size={12} aria-hidden="true" />}
      AI: {claude ? "Claude" : "Offline"}
    </span>
  );
}

function alertHref(a: AlertOut): string | null {
  if (!a.ref_id) return null;
  if (a.ref_type === "obligation") return `/obligations?id=${a.ref_id}`;
  if (a.ref_type === "regulation") return `/regulations/${a.ref_id}`;
  if (a.ref_type === "task") return `/tasks?task=${a.ref_id}`;
  if (a.ref_type === "approval") return `/approvals?id=${a.ref_id}`;
  if (a.ref_type === "filing") return `/filings?filing=${a.ref_id}`;
  return null;
}

function AlertsBell() {
  const router = useRouter();
  const toast = useToast();
  const alerts = useQuery<AlertOut[]>("alerts:unread", (signal) => api.alerts.list({ unread: true, limit: 30 }, { signal }));
  const [busy, setBusy] = useState(false);
  const { reload } = alerts;

  useEffect(() => {
    const id = window.setInterval(reload, 60_000);
    return () => window.clearInterval(id);
  }, [reload]);

  const items = alerts.data ?? [];
  const count = items.length;

  async function open(a: AlertOut, close: () => void) {
    close();
    alerts.setData((prev) => (prev ?? []).filter((x) => x.id !== a.id));
    api.alerts.read(a.id).catch(() => alerts.reload());
    const href = alertHref(a);
    if (href) router.push(href);
  }

  async function readAll() {
    setBusy(true);
    try {
      await api.alerts.readAll();
      alerts.setData([]);
    } catch (e) {
      toast.error("Couldn't mark alerts as read", errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover
      trigger={(p) => (
        <button
          type="button"
          onClick={p.toggle}
          aria-expanded={p["aria-expanded"]}
          aria-label={count ? `Alerts, ${count} unread` : "Alerts"}
          className={iconTileClass(
            "soft",
            "md",
            "relative border-line-strong/70! text-ink-2 transition-[box-shadow,color] hover:text-accent active:shadow-inset-sm",
          )}
        >
          <Bell size={18} aria-hidden="true" />
          {count > 0 && <CountBadge count={count} className="absolute -right-1.5 -top-1.5" />}
        </button>
      )}
      panelClassName="w-[min(400px,calc(100vw-24px))] p-0 overflow-hidden"
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between px-5 pb-2 pt-4">
            <p className="display text-[15.5px]">Unread alerts</p>
            {count > 0 && (
              <button
                type="button"
                onClick={readAll}
                disabled={busy}
                className="rounded-full px-2 py-1 text-[12.5px] font-medium text-accent hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto px-2 pb-2">
            {alerts.loading && !alerts.data && (
              <div className="flex justify-center py-6 text-ink-3">
                <Spinner />
              </div>
            )}
            {alerts.error != null && !alerts.data && <p className="px-3.5 py-4 text-[13px] text-danger">{errorMessage(alerts.error)}</p>}
            {alerts.data && count === 0 && (
              <p className="px-3.5 py-6 text-center text-[13px] text-ink-3">You&rsquo;re up to date. New gaps and regulatory changes will appear here.</p>
            )}
            {items.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => open(a, close)}
                className="flex w-full gap-3 rounded-[16px] px-3 py-2.5 text-left hover:bg-surface-2"
              >
                <SeverityGlyph severity={a.severity} className="mt-1" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[13px] font-medium leading-snug">{a.title}</span>
                  {a.body && <span className="mt-0.5 line-clamp-1 text-[12px] text-ink-3">{a.body}</span>}
                  <span className="mt-1 block text-[11.5px] text-ink-3">
                    {humanize(a.kind)} · {relativeTime(a.created_at)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}

function ThemeToggle() {
  const theme = useResolvedTheme();
  const dark = theme === "dark";
  return (
    <span title={dark ? "Dark theme is on" : "Dark theme is off"} className="hidden sm:inline-flex">
      <Toggle
        checked={dark}
        onChange={(v) => setThemePref(v ? "dark" : "light")}
        label="Dark theme"
        labelHidden
        knobIcon={dark ? <Moon size={12} strokeWidth={2.2} /> : <Sun size={12} strokeWidth={2.2} />}
      />
    </span>
  );
}

function UserMenu() {
  const { user, role, org, isSuperuser, logout } = useAuth();
  const pref = useThemePref();
  if (!user) return null;
  const themes: { value: ThemePref; label: string; icon: React.ReactNode }[] = [
    { value: "system", label: "System", icon: <Monitor size={13} /> },
    { value: "light", label: "Light", icon: <Sun size={13} /> },
    { value: "dark", label: "Dark", icon: <Moon size={13} /> },
  ];
  return (
    <Popover
      trigger={(p) => (
        <button
          type="button"
          onClick={p.toggle}
          aria-expanded={p["aria-expanded"]}
          aria-label="Account menu"
          className="rounded-full transition-transform active:translate-y-px"
        >
          <Avatar name={user.name} size={40} className="text-[14px]" />
        </button>
      )}
      panelClassName="w-72"
    >
      {(close) => (
        <div>
          <div className="flex items-center gap-3 px-3 pb-3 pt-2.5">
            <Avatar name={user.name} size={40} />
            <div className="min-w-0">
            <p className="truncate text-[13.5px] font-medium">{user.name}</p>
            <p className="truncate text-[12px] text-ink-3">{user.email}</p>
            <p className="mt-1.5 text-[12px] text-ink-2">
              {role && humanize(role)} at {org?.name}
              {isSuperuser && <span className="ml-1.5 rounded-full bg-accent-wash px-1.5 py-px text-[11px] text-accent">Platform admin</span>}
            </p>
            </div>
          </div>
          <div className="mx-1 rounded-[18px] px-2 py-2.5">
            <p className="eyebrow mb-2 px-1">Theme</p>
            <SegmentedControl
              label="Theme"
              size="sm"
              value={pref}
              onChange={(v) => setThemePref(v)}
              className="w-full [&>button]:flex-1"
              options={themes.map((t) => ({
                value: t.value,
                label: (
                  <>
                    {t.icon}
                    {t.label}
                  </>
                ),
              }))}
            />
          </div>
          <div className="mx-2 border-t border-line pt-1.5">
            <MenuItem
              icon={<LogOut size={14} />}
              onClick={() => {
                close();
                logout();
              }}
            >
              Sign out
            </MenuItem>
          </div>
        </div>
      )}
    </Popover>
  );
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-[76px] items-center gap-3 bg-canvas/85 px-4 backdrop-blur-md sm:px-8">
      <IconButton label="Open navigation" tone="soft" className="lg:hidden" onClick={onMenu}>
        <Menu size={18} />
      </IconButton>
      <OrgSwitcher />
      <div className="flex-1" />
      <AiBadge />
      <AlertsBell />
      <ThemeToggle />
      <UserMenu />
    </header>
  );
}
