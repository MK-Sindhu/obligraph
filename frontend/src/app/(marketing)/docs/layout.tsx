import { DocsNav } from "@/components/docs/docs-nav";
import { DocsSearch } from "@/components/docs/docs-search";
import { DOC_GROUPS, docIndex } from "@/lib/docs";

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  const docs = docIndex();
  return (
    <div className="mx-auto grid w-full max-w-[1280px] gap-6 px-4 pb-16 pt-8 sm:px-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-8">
      <aside className="lg:sticky lg:top-[96px] lg:max-h-[calc(100dvh-112px)] lg:self-start">
        <div className="card flex flex-col gap-4 rounded-card p-3 lg:max-h-[calc(100dvh-112px)]">
          <DocsSearch docs={docs} />
          <div className="min-h-0 overflow-y-auto pb-1 lg:pr-1">
            <DocsNav docs={docs} groups={DOC_GROUPS} />
          </div>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
