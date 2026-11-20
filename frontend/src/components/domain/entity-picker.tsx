"use client";

import { Check } from "lucide-react";
import { Chip } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/states";
import { useVocab } from "@/lib/vocab";

/** Multi-select of entity classes, grouped by the regulator that licenses them. */
export function EntityClassPicker({
  value,
  onChange,
  disabled,
  id,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
  id?: string;
}) {
  const { vocab, error, reload } = useVocab();
  if (error && !vocab) {
    return (
      <p className="text-[13px] text-danger">
        Couldn&rsquo;t load entity types.{" "}
        <button type="button" className="underline" onClick={reload}>
          Try again
        </button>
      </p>
    );
  }
  if (!vocab) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
    );
  }
  const groups = new Map<string, typeof vocab.entity_classes>();
  for (const ec of vocab.entity_classes) {
    groups.set(ec.regulator, [...(groups.get(ec.regulator) ?? []), ec]);
  }
  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  return (
    <div id={id} role="group" aria-label="Entity types" className="space-y-3">
      {[...groups.entries()].map(([reg, items]) => (
        <div key={reg}>
          <p className="mb-2 text-[11.5px] font-medium text-ink-3">Licensed by {reg}</p>
          <div className="flex flex-wrap gap-2">
            {items.map((ec) => {
              const on = value.includes(ec.key);
              return (
                <Chip
                  key={ec.key}
                  role="checkbox"
                  aria-checked={on}
                  active={on}
                  disabled={disabled}
                  onClick={() => toggle(ec.key)}
                  className="disabled:opacity-60"
                  icon={on ? <Check size={12} aria-hidden="true" /> : undefined}
                >
                  {ec.label}
                </Chip>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
