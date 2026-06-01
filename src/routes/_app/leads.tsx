import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_app/leads")({
  component: () => <ComingSoon title="Leads" phase="Phase 2" desc="Capture, route, and follow up on enquiries." />,
});
