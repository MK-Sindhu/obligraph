"use client";

import type { ReactNode } from "react";
import { Tabs } from "@/components/ui/tabs";

/** Settings section tabs: the soft segmented control from the design system. */
export function TabList<T extends string>({
  value,
  onChange,
  tabs,
  label,
  idPrefix,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: ReactNode }[];
  label: string;
  idPrefix: string;
}) {
  return <Tabs value={value} onChange={onChange} tabs={tabs} label={label} idPrefix={idPrefix} className="mb-6" />;
}
