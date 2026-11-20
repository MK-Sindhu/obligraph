import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingBlock } from "@/components/ui/states";
import { RegulationsView } from "./regulations-view";

export const metadata: Metadata = { title: "Regulations" };

export default function RegulationsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <RegulationsView />
    </Suspense>
  );
}
