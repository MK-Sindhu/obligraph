import { Suspense } from "react";
import { LoadingBlock } from "@/components/ui/states";
import { ReportsView } from "./reports-view";

export default function ReportsPage() {
  return (
    <>
      <title>Reports · Obligraph</title>
      <Suspense fallback={<LoadingBlock label="Loading the board pack…" />}>
        <ReportsView />
      </Suspense>
    </>
  );
}
