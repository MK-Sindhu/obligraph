import clsx from "clsx";
import { useId } from "react";

/** Obligraph mark: a blue-gradient tile holding three linked nodes (instrument → obligation → policy). */
export function LogoMark({ size = 22, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={clsx("shrink-0", className)}
      style={{ filter: size >= 20 ? "drop-shadow(0 3px 5px rgb(43 91 255 / 0.35))" : undefined }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`lm-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3f8cff" />
          <stop offset="100%" stopColor="#2348f5" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="23" height="23" rx="7" fill={`url(#lm-${id})`} />
      <path d="M8.2 8.6 L15.9 10.2 M8.2 8.6 L10.1 15.8 M15.9 10.2 L10.1 15.8" stroke="#ffffff" strokeWidth="1.3" strokeOpacity="0.8" fill="none" />
      <circle cx="8.2" cy="8.6" r="2.2" fill="#ffffff" />
      <circle cx="15.9" cy="10.2" r="1.75" fill="#ffffff" />
      <circle cx="10.1" cy="15.8" r="1.75" fill="#ffffff" />
    </svg>
  );
}

export function Wordmark({ className, size = 30 }: { className?: string; size?: number }) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className="text-[19px] font-semibold leading-none tracking-[-0.015em] text-ink">Obligraph</span>
    </span>
  );
}

export function Splash({ label = "Opening your workspace…" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas" role="status">
      <span className="flex h-20 w-20 items-center justify-center rounded-[26px] soft">
        <LogoMark size={38} className="animate-pulse" />
      </span>
      <p className="text-[13px] text-ink-3">{label}</p>
    </div>
  );
}
