"use client";

import clsx from "clsx";
import { AlertTriangle, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { ApiError, errorMessage } from "@/lib/api";

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={clsx("animate-spin text-current", className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-[14px] bg-surface-3", className)} aria-hidden="true" />;
}

/** Placeholder rows for tables and lists while data loads. */
export function LoadingRows({ rows = 5, className, label = "Loading" }: { rows?: number; className?: string; label?: string }) {
  return (
    <div className={clsx("space-y-3 px-6 py-4", className)} role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}

export function LoadingBlock({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={clsx("flex items-center justify-center gap-2 py-12 text-ink-3", className)} role="status">
      <Spinner />
      <span className="text-[13px]">{label}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
  compact,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={clsx("flex flex-col items-center text-center", compact ? "px-4 py-6" : "px-6 py-12", className)}>
      {icon && <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[16px] border border-line bg-surface text-primary [&_svg]:stroke-[1.6]">{icon}</div>}
      <p className="display text-[16px] text-ink">{title}</p>
      {children && <div className="mt-1 max-w-md text-[13px] text-ink-2">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  className,
  compact,
  title,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
  title?: string;
}) {
  const forbidden = error instanceof ApiError && error.status === 403;
  return (
    <div
      role="alert"
      className={clsx("flex flex-col items-center text-center", compact ? "px-4 py-6" : "px-6 py-12", className)}
    >
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-[16px] bg-danger-bg text-danger">
        <AlertTriangle size={20} aria-hidden="true" />
      </span>
      <p className="display text-[16px]">
        {title ?? (forbidden ? "You don't have access to this" : "Couldn't load this")}
      </p>
      <p className="mt-1 max-w-md text-[13px] text-ink-2">{errorMessage(error)}</p>
      {onRetry && !forbidden && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong/80 bg-surface px-4 text-[13px] font-medium text-accent shadow-xs hover:shadow-card"
        >
          <RotateCw size={13} aria-hidden="true" /> Try again
        </button>
      )}
    </div>
  );
}

/** Small inline error line used inside forms and dialogs. */
export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-[14px] border border-danger/25 bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger">
      {errorMessage(error)}
    </p>
  );
}
