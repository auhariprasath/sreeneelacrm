import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_app/reports")({
  component: () => <ComingSoon title="Reports" phase="Phase 6" desc="Performance analytics and exports." />,
});
