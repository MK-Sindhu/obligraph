import { Suspense } from "react";
import { CopilotView } from "@/components/copilot/copilot-view";
import { LoadingBlock } from "@/components/ui/states";

export default function CopilotPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Opening Copilot…" />}>
      <CopilotView />
    </Suspense>
  );
}
