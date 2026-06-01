import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_app/calendar")({
  component: () => <ComingSoon title="Calendar" phase="Phase 4" desc="Venue availability and event schedule." />,
});
