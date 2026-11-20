"use client";

import clsx from "clsx";
import { MessagesSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/states";
import type { ConversationOut } from "@/lib/api";
import { relativeTime } from "@/lib/format";

export function ConversationList({
  items,
  loading,
  error,
  onRetry,
  activeId,
  onSelect,
  onNew,
  onDelete,
  disabled,
}: {
  items: ConversationOut[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (c: ConversationOut) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-5 pb-3 pt-5">
        <p className="display text-[16px]">Conversations</p>
        <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={onNew}>
          New
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {loading && !items && (
          <div className="space-y-3 p-2" role="status" aria-label="Loading conversations">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            ))}
          </div>
        )}
        {error != null && !items && <ErrorState compact error={error} onRetry={onRetry} title="Couldn't load conversations" />}
        {items && items.length === 0 && (
          <div className="px-3 py-8 text-center">
            <MessagesSquare size={22} className="mx-auto text-accent" aria-hidden="true" />
            <p className="mt-2 text-[13px] font-medium">No conversations yet</p>
            <p className="mt-0.5 text-[12px] text-ink-3">Questions you ask are kept here for you, per organisation.</p>
          </div>
        )}
        {items && items.length > 0 && (
          <ul className="space-y-1">
            {items.map((c) => {
              const active = c.id === activeId;
              return (
                <li key={c.id} className="group relative">
                  <button
                    type="button"
                    disabled={disabled && !active}
                    onClick={() => onSelect(c.id)}
                    aria-current={active ? "true" : undefined}
                    className={clsx(
                      "block w-full rounded-[18px] py-2.5 pl-3.5 pr-10 text-left transition-[background-color,box-shadow] disabled:opacity-50",
                      active ? "soft-xs" : "hover:bg-surface-2",
                    )}
                  >
                    <span className={clsx("line-clamp-2 text-[13px] leading-snug", active ? "font-medium text-accent" : "text-ink-2")}>
                      {c.title || "Untitled conversation"}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-ink-3">{relativeTime(c.updated_at)}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete conversation: ${c.title}`}
                    title="Delete conversation"
                    onClick={() => onDelete(c)}
                    className="absolute right-2 top-2.5 rounded-full p-1.5 text-ink-3 opacity-0 transition-opacity hover:bg-danger-bg hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
