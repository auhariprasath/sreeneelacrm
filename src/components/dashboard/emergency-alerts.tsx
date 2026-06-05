import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateIN } from "@/lib/format";

interface AlertRow {
  id: string;
  lead_id: string;
  event_date: string;
  full_name: string;
  company_name: string;
  brand_color: string;
}

export function EmergencyAlerts() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { data } = await supabase
        .from("bookings")
        .select("id, lead_id, event_date, assigned_to, created_at, companies(name, brand_color), leads(full_name)")
        .is("deleted_at", null)
        .eq("status", "confirmed")
        .is("assigned_to", null)
        .lt("created_at", cutoff)
        .gte("event_date", new Date().toISOString().slice(0, 10))
        .order("event_date", { ascending: true })
        .limit(20);
      if (cancelled) return;
      setAlerts((data ?? []).map((b: any) => ({
        id: b.id, lead_id: b.lead_id, event_date: b.event_date,
        full_name: b.leads?.full_name ?? "—",
        company_name: b.companies?.name ?? "—",
        brand_color: b.companies?.brand_color ?? "#ef4444",
      })));
    };
    load();
    const ch = supabase.channel("dash-alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, load)
      .subscribe();
    const t = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(t); supabase.removeChannel(ch); };
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <Link
          key={a.id}
          to="/leads/$leadId"
          params={{ leadId: a.lead_id }}
          className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3 sm:p-4 hover:bg-destructive/10 transition-colors"
        >
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-destructive">
              No coordinator assigned — {a.full_name}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Event {formatDateIN(a.event_date)} · {a.company_name} · confirmed over 24h ago
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
