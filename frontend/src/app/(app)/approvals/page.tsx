import { Suspense } from "react";
import { LoadingBlock } from "@/components/ui/states";
import { ApprovalsView } from "./approvals-view";

export default function ApprovalsPage() {
  return (
    <>
      <title>Approvals · Obligraph</title>
      <Suspense fallback={<LoadingBlock label="Loading approvals…" />}>
        <ApprovalsView />
      </Suspense>
    </>
  );
}
