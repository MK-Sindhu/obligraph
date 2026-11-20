import { Suspense } from "react";
import { LoadingBlock } from "@/components/ui/states";
import { EvidenceView } from "./evidence-view";

export default function EvidencePage() {
  return (
    <>
      <title>Evidence · Obligraph</title>
      <Suspense fallback={<LoadingBlock label="Loading evidence…" />}>
        <EvidenceView />
      </Suspense>
    </>
  );
}
