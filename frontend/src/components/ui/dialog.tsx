"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button, IconButton } from "./button";

interface BaseProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Short line under the title. */
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  labelledBy?: string;
}

function useModal(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return ref;
}

/** Centered modal built on the native <dialog> (focus trap + Esc for free). */
export function Dialog({ open, onClose, title, subtitle, children, footer, className }: BaseProps) {
  const ref = useModal(open);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={clsx(
        "overlay m-auto w-[min(560px,calc(100vw-24px))] max-h-[calc(100dvh-48px)] overflow-hidden rounded-[32px] p-0 text-ink",
        "open:flex open:flex-col open:animate-[rise-in_160ms_ease-out]",
        className,
      )}
    >
      {open && (
        <>
          <header className="flex items-start gap-3 px-7 pb-3 pt-6">
            <div className="min-w-0 flex-1">
              <h2 className="display text-[19px] leading-tight">{title}</h2>
              {subtitle && <div className="mt-1 text-[13px] text-ink-3">{subtitle}</div>}
            </div>
            <IconButton label="Close" size="sm" tone="soft" onClick={onClose}>
              <X size={16} />
            </IconButton>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-7 py-3">{children}</div>
          {footer && <footer className="flex flex-wrap items-center justify-end gap-2.5 px-7 pb-6 pt-4">{footer}</footer>}
        </>
      )}
    </dialog>
  );
}

/** Right-hand side sheet for record details. */
export function Drawer({ open, onClose, title, subtitle, children, footer, className }: BaseProps) {
  const ref = useModal(open);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={clsx(
        "overlay fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[min(640px,100vw)] max-w-none overflow-hidden p-0 text-ink sm:rounded-l-[34px]",
        "open:flex open:flex-col open:animate-[drawer-in_180ms_ease-out]",
        className,
      )}
    >
      {open && (
        <>
          <header className="flex items-start gap-3 border-b border-line px-7 pb-4 pt-6">
            <div className="min-w-0 flex-1">{typeof title === "string" ? <h2 className="display text-[19px]">{title}</h2> : title}</div>
            <IconButton label="Close" size="sm" tone="soft" onClick={onClose}>
              <X size={16} />
            </IconButton>
          </header>
          {subtitle}
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer && <footer className="flex flex-wrap items-center gap-2.5 border-t border-line px-7 py-4">{footer}</footer>}
        </>
      )}
    </dialog>
  );
}

/** Confirmation dialog for destructive actions. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      className="w-[min(440px,calc(100vw-24px))]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[13.5px] text-ink-2">{children}</div>
    </Dialog>
  );
}
