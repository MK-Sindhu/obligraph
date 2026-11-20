import Link from "next/link";
import { LogoMark } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <div className="flex w-full max-w-[440px] flex-col items-center gap-3 rounded-card-lg card px-8 py-11 text-center">
        <LogoMark size={40} />
        <p className="docket mt-2">Error 404</p>
        <h1 className="display text-[24px]">This page isn&rsquo;t on file</h1>
        <p className="max-w-sm text-[13.5px] text-ink-2">The address may be mistyped, or the record was removed.</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex h-10 items-center rounded-full bg-primary-fill px-6 text-[13.5px] font-medium text-white"
        >
          Go to the dashboard
        </Link>
      </div>
    </div>
  );
}
