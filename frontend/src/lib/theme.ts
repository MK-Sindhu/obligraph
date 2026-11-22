"use client";

import { useSyncExternalStore } from "react";

export type ThemePref = "system" | "light" | "dark";
const KEY = "obligraph.theme";
const listeners = new Set<() => void>();

// Light is the default; "system" (follow the OS) and "dark" are saved choices.
function readPref(): ThemePref {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "dark" || v === "system" ? v : "light";
  } catch {
    return "light";
  }
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === "light") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, pref);
  } catch {
    /* storage unavailable */
  }
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    mq.removeEventListener("change", listener);
  };
}

function resolved(): "light" | "dark" {
  const pref = readPref();
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, readPref, () => "light");
}

/** The theme actually in effect (resolves "system"). */
export function useResolvedTheme(): "light" | "dark" {
  return useSyncExternalStore(subscribe, resolved, () => "light");
}

/** Read a CSS custom property from :root (for canvas drawing). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
