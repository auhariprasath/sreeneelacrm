import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDashboardRealtime } from "@/hooks/use-dashboard-realtime";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, ArrowLeft, AlertCircle, CheckCircle2, Phone, MessageCircle } from "lucide-react";
import { buildWaMeLink, openWaMeLink } from "@/lib/utils";
import { formatDateTimeIN } from "@/lib/format";
import { StatusBadge } from "@/components/leads/lead-badges";

type Filter = "everything" | "overdue" | "upcoming" | "all" | "completed";

const ACTIVE_STATUSES = ["scheduled", "reminder_sent", "rescheduled"] as const;

export const Route = createFileRoute("/_app/venue-meetings")({
  validateSearch: (s: Record<string, unknown>): { filter?: Filter } => ({
    filter: (["everything", "overdue", "upcoming", "all", "completed"].includes(s.filter as string) ? s.filter : "upcoming") as Filter,
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
  status: string;
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
    const isCompleted = filter === "completed";
    const isEverything = filter === "everything";
    let q = supabase.from("venue_meetings")
      .select("id, lead_id, scheduled_date, scheduled_time, status, contact_person_name, company_id, leads!inner(full_name, phone, status)")
      .is("deleted_at", null)
      .order("scheduled_date", { ascending: !isCompleted })
      .order("scheduled_time", { ascending: !isCompleted })
      .limit(500);
    if (!isEverything) {
      if (isCompleted) q = q.not("status", "in", `(${ACTIVE_STATUSES.join(",")})`);
      else q = q.in("status", ACTIVE_STATUSES);
    }
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
      status: m.status,
    }));

    if (meetings.length > 0) {
      const leadIds = [...new Set(meetings.map((m) => m.lead_id))];
      const { data: reqs } = await supabase
        .from("requirements").select("lead_id, event_type")
        .in("lead_id", leadIds).is("deleted_at", null)
        .order("created_at", { ascending: false });
      const eventTypeMap: Record<string, string> = {};
      for (const r of (reqs ?? []) as any[]) {
        if (r.lead_id && r.event_type && !eventTypeMap[r.lead_id]) eventTypeMap[r.lead_id] = r.event_type;
      }
      for (const m of meetings) m.event_type = eventTypeMap[m.lead_id] ?? null;
    }

    const now = Date.now();
    setRows(
      filter === "everything" ? meetings.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
      : filter === "overdue" ? meetings.filter((r) => ACTIVE_STATUSES.includes(r.status) && new Date(r.scheduled_at).getTime() < now)
      : filter === "upcoming" ? meetings.filter((r) => ACTIVE_STATUSES.includes(r.status) && new Date(r.scheduled_at).getTime() >= now)
      : filter === "completed" ? meetings
      : meetings.sort((a, b) => {
          const aOver = new Date(a.scheduled_at).getTime() < now;
          const bOver = new Date(b.scheduled_at).getTime() < now;
          if (aOver !== bOver) return aOver ? 1 : -1;
          return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
        })
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
          <TabsTrigger value="everything">All</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="all">All active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
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
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contact</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Contact</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isActive = ACTIVE_STATUSES.includes(r.status);
                const overdue = isActive && new Date(r.scheduled_at).getTime() < Date.now();
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
                    <td className="px-4 py-3">
                      {!isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                        </span>
                      ) : overdue ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                          <AlertCircle className="h-3.5 w-3.5" /> Overdue
                        </span>
                      ) : (
                        <span className="text-xs text-warning font-medium">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.contact_person_name || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a href={`tel:${r.phone}`} title="Call" className="inline-flex items-center justify-center h-8 w-8 rounded-md border hover:bg-accent transition-colors">
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                        <button
                          type="button"
                          title="WhatsApp"
                          disabled={!r.phone}
                          onClick={() => { const u = buildWaMeLink(r.phone); if (u) openWaMeLink(u); }}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md border hover:bg-accent transition-colors disabled:opacity-40"
                        >
                          <MessageCircle className="h-3.5 w-3.5 text-success" />
                        </button>
                      </div>
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
