import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_app/notifications")({
  component: () => <ComingSoon title="Notifications" phase="Phase 2" desc="Inbox of all alerts (chunk 5)." />,
});
