import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_app/bookings")({
  component: () => <ComingSoon title="Bookings" phase="Phase 4" desc="Manage confirmed events and payments." />,
});
