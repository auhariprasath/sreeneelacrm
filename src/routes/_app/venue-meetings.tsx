import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDashboardRealtime } from "@/hooks/use-dashboard-realtime";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, ArrowLeft, AlertCircle } from "lucide-react";
import { formatDateTimeIN } from "@/lib/format";

type Filter = "overdue" | "upcoming" | "all";

export const Route = createFileRoute("/_app/venue-meetings")({
  validateSearch: (s: Record<string, unknown>): { filter?: Filter } => ({
    filter: (s.filter === "overdue" || s.filter === "upcoming" || s.filter === "all") ? s.filter : "upcoming",
  }),
  component: VenueMeetingsPage,
});

interface Row { id: string; lead_id: string; full_name: string; scheduled_at: string; contact_person_name: string | null }

function VenueMeetingsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const filter: Filter = search.filter ?? "upcoming";
  const { role, profile, activeCompanyId, companies } = useAuth();
  const companyId = role === "super_admin" ? activeCompanyId : (profile?.company_id ?? companies[0]?.id ?? null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("venue_meetings")
      .select("id, lead_id, scheduled_date, scheduled_time, contact_person_name, company_id, leads!inner(full_name)")
      .is("deleted_at", null)
      .in("status", ["scheduled", "reminder_sent", "rescheduled"])
      .order("scheduled_date", { ascending: true })
      .order("scheduled_time", { ascending: true })
      .limit(200);
    if (companyId) q = q.eq("company_id", companyId);
    const { data } = await q;
    const all = ((data ?? []) as any[]).map((m) => ({
      id: m.id,
      lead_id: m.lead_id,
      full_name: m.leads?.full_name ?? "—",
      scheduled_at: `${m.scheduled_date}T${m.scheduled_time}`,
      contact_person_name: m.contact_person_name ?? null,
    }));
    const now = Date.now();
    setRows(
      filter === "overdue" ? all.filter((r) => new Date(r.scheduled_at).getTime() < now)
      : filter === "upcoming" ? all.filter((r) => new Date(r.scheduled_at).getTime() >= now)
      : all
    );
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId, filter]);
  useDashboardRealtime(["venue_meetings"], load);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5" />
        <h1 className="text-xl font-semibold">Venue meetings</h1>
      </div>
      <Tabs value={filter} onValueChange={(v) => navigate({ search: { filter: v as Filter } })}>
        <TabsList>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="all">All active</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground text-center">No venue meetings in this view.</Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const overdue = new Date(r.scheduled_at).getTime() < Date.now();
            return (
              <Link key={r.id} to="/leads/$leadId" params={{ leadId: r.lead_id }}>
                <Card className="p-3 flex items-center justify-between hover:bg-accent/40 transition">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.full_name}</div>
                    <div className={`text-xs ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {overdue && <AlertCircle className="inline h-3 w-3 mr-1" />}
                      {overdue ? "Overdue " : ""}{formatDateTimeIN(r.scheduled_at)}
                      {r.contact_person_name ? ` · ${r.contact_person_name}` : ""}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost">Open</Button>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
