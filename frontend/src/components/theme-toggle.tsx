"use client";

import { Moon, Sun } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { setThemePref, useResolvedTheme } from "@/lib/theme";

/** Light/dark switch (sun/moon knob). Shared by the app top bar, sign-in pages and public site. */
export function ThemeToggle({ className = "inline-flex" }: { className?: string }) {
  const dark = useResolvedTheme() === "dark";
  return (
    <span title={dark ? "Dark theme is on" : "Dark theme is off"} className={className}>
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
