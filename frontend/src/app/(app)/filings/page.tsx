import { Suspense } from "react";
import { LoadingBlock } from "@/components/ui/states";
import { FilingsView } from "./filings-view";

export default function FilingsPage() {
  return (
    <>
      <title>Filings · Obligraph</title>
      <Suspense fallback={<LoadingBlock label="Loading filings…" />}>
        <FilingsView />
      </Suspense>
    </>
  );
}
