import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingNav } from "@/components/marketing/nav";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <a
        href="#main"
        className="overlay fixed left-3 top-3 z-50 -translate-y-24 rounded-full px-4 py-2 text-[13px] font-medium text-ink focus-visible:translate-y-0"
      >
        Skip to content
      </a>
      <MarketingNav />
      <main id="main" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
