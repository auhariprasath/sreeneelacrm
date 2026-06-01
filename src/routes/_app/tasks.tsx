import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_app/tasks")({
  component: () => <ComingSoon title="Task Board" phase="Phase 5" desc="Team task management and follow-ups." />,
});
