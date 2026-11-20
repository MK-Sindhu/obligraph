import { Suspense } from "react";
import { GraphExplorer } from "@/components/graph/graph-explorer";
import { LoadingBlock } from "@/components/ui/states";

export default function GraphPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Loading the graph…" />}>
      <GraphExplorer />
    </Suspense>
  );
}
