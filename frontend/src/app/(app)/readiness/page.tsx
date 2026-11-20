import { Suspense } from "react";
import { LoadingBlock } from "@/components/ui/states";
import { ReadinessView } from "./readiness-view";

export default function ReadinessPage() {
  return (
    <>
      <title>Readiness · Obligraph</title>
      <Suspense fallback={<LoadingBlock label="Loading readiness…" />}>
        <ReadinessView />
      </Suspense>
    </>
  );
}
