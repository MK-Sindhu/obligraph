import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingBlock } from "@/components/ui/states";
import { CalendarView } from "./calendar-view";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <CalendarView />
    </Suspense>
  );
}
