import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDashboardRealtime } from "@/hooks/use-dashboard-realtime";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, ArrowLeft, AlertCircle } from "lucide-react";
import { formatDateTimeIN } from "@/lib/format";
import { StatusBadge } from "@/components/leads/lead-badges";

type Filter = "overdue" | "upcoming" | "all";

export const Route = createFileRoute("/_app/venue-meetings")({
  validateSearch: (s: Record<string, unknown>): { filter?: Filter } => ({
    filter: (s.filter === "overdue" || s.filter === "upcoming" || s.filter === "all") ? s.filter : "upcoming",
  }),
  component: VenueMeetingsPage,
});

interface Row {
  id: string;
  lead_id: string;
  full_name: string;
  phone: string;
  lead_status: string;
  event_type: string | null;
  scheduled_at: string;
  contact_person_name: string | null;
}

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
      .select("id, lead_id, scheduled_date, scheduled_time, contact_person_name, company_id, leads!inner(full_name, phone, status)")
      .is("deleted_at", null)
      .in("status", ["scheduled", "reminder_sent", "rescheduled"])
      .order("scheduled_date", { ascending: true })
      .order("scheduled_time", { ascending: true })
      .limit(200);
    if (companyId) q = q.eq("company_id", companyId);
    const { data } = await q;

    const meetings = ((data ?? []) as any[]).map((m) => ({
      id: m.id,
      lead_id: m.lead_id,
      full_name: m.leads?.full_name ?? "—",
      phone: m.leads?.phone ?? "",
      lead_status: m.leads?.status ?? "new",
      event_type: null as string | null,
      scheduled_at: `${m.scheduled_date}T${m.scheduled_time}`,
      contact_person_name: m.contact_person_name ?? null,
    }));

    if (meetings.length > 0) {
      const leadIds = [...new Set(meetings.map((m) => m.lead_id))];
      const { data: reqs } = await supabase
        .from("requirements")
        .select("lead_id, event_type")
        .in("lead_id", leadIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      const eventTypeMap: Record<string, string> = {};
      for (const r of (reqs ?? []) as any[]) {
        if (r.lead_id && r.event_type && !eventTypeMap[r.lead_id]) {
          eventTypeMap[r.lead_id] = r.event_type;
        }
      }
      for (const m of meetings) {
        m.event_type = eventTypeMap[m.lead_id] ?? null;
      }
    }

    const now = Date.now();
    setRows(
      filter === "overdue" ? meetings.filter((r) => new Date(r.scheduled_at).getTime() < now)
      : filter === "upcoming" ? meetings.filter((r) => new Date(r.scheduled_at).getTime() >= now)
      : meetings
    );
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId, filter]);
  useDashboardRealtime(["venue_meetings"], load);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
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
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Event type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Lead status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Scheduled at</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contact</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const overdue = new Date(r.scheduled_at).getTime() < Date.now();
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{r.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.phone || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.event_type || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.lead_status as any} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={overdue ? "text-destructive font-medium flex items-center gap-1" : "text-muted-foreground"}>
                        {overdue && <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                        {formatDateTimeIN(r.scheduled_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.contact_person_name || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/leads/$leadId"
                        params={{ leadId: r.lead_id }}
                        className="text-xs text-primary hover:underline"
                      >
                        Open lead →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
