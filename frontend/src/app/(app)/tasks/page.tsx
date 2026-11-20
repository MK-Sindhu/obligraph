import { Suspense } from "react";
import { LoadingBlock } from "@/components/ui/states";
import { TaskBoard } from "./task-board";

export default function TasksPage() {
  return (
    <>
      <title>Tasks · Obligraph</title>
      <Suspense fallback={<LoadingBlock label="Loading tasks…" />}>
        <TaskBoard />
      </Suspense>
    </>
  );
}
