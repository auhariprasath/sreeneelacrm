import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CombinedCalendar } from "./combined-calendar";
import { StatsRow } from "./stats-row";
import { EmergencyAlerts } from "./emergency-alerts";
import { CompanyPanel } from "./company-panel";

interface CompanyRow { id: string; name: string; brand_color: string | null }

export function SuperAdminDashboard() {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.from("companies")
        .select("id, name, brand_color").is("deleted_at", null).order("name");
      if (!cancelled) setCompanies((data ?? []) as CompanyRow[]);
    };
    load();
    const ch = supabase.channel("sa-companies")
      .on("postgres_changes", { event: "*", schema: "public", table: "companies" }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {profile?.full_name || "there"}</h1>
        <p className="text-sm text-muted-foreground">All companies overview</p>
      </div>
      <CombinedCalendar />
      <StatsRow />
      <EmergencyAlerts />
      <div className="space-y-4">
        {companies.map((c) => (
          <CompanyPanel key={c.id} companyId={c.id} companyName={c.name} brandColor={c.brand_color || "#6366f1"} />
        ))}
      </div>
    </div>
  );
}
