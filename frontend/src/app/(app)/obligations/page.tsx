import { Suspense } from "react";
import { LoadingBlock } from "@/components/ui/states";
import { ObligationsView } from "./obligations-view";

export default function ObligationsPage() {
  return (
    <>
      <title>Obligations · Obligraph</title>
      <Suspense fallback={<LoadingBlock label="Loading obligations…" />}>
        <ObligationsView />
      </Suspense>
    </>
  );
}
