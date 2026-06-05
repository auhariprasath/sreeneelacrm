import { useAuth } from "@/lib/auth";
import { CombinedCalendar } from "./combined-calendar";
import { StatsRow } from "./stats-row";
import { EmergencyAlerts } from "./emergency-alerts";

export function SuperAdminDashboard() {
  const { profile } = useAuth();
  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {profile?.full_name || "there"}</h1>
        <p className="text-sm text-muted-foreground">All companies overview</p>
      </div>
      <CombinedCalendar />
      <StatsRow />
      <EmergencyAlerts />
    </div>
  );
}
