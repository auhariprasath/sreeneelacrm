import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDashboardRealtime } from "@/hooks/use-dashboard-realtime";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, ArrowLeft, AlertCircle } from "lucide-react";
import { formatDateTimeIN } from "@/lib/format";

type Filter = "overdue" | "upcoming" | "all";

export const Route = createFileRoute("/_app/follow-ups")({
  validateSearch: (s: Record<string, unknown>): { filter?: Filter } => ({
    filter: (s.filter === "overdue" || s.filter === "upcoming" || s.filter === "all") ? s.filter : "upcoming",
  }),
  component: FollowUpsPage,
});

interface Row { id: string; lead_id: string; full_name: string; scheduled_at: string }

function FollowUpsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const filter: Filter = search.filter ?? "upcoming";
  const { role, profile, activeCompanyId, companies } = useAuth();
  const companyId = role === "super_admin" ? activeCompanyId : (profile?.company_id ?? companies[0]?.id ?? null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("follow_ups")
      .select("id, lead_id, scheduled_at, leads!inner(full_name, company_id)")
      .eq("is_sent", false).eq("is_cancelled", false)
      .order("scheduled_at", { ascending: true }).limit(200);
    if (companyId) q = q.eq("leads.company_id", companyId);
    const { data } = await q;
    const all = ((data ?? []) as any[]).map((f) => ({
      id: f.id, lead_id: f.lead_id, full_name: f.leads?.full_name ?? "—", scheduled_at: f.scheduled_at,
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
  useDashboardRealtime(["follow_ups"], load);

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
      <div className="flex items-center gap-2">
        <Phone className="h-5 w-5" />
        <h1 className="text-xl font-semibold">Follow-ups</h1>
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
        <Card className="p-6 text-sm text-muted-foreground text-center">No follow-ups in this view.</Card>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Lead name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Scheduled at</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const overdue = new Date(r.scheduled_at).getTime() < Date.now();
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{r.full_name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTimeIN(r.scheduled_at)}
                    </td>
                    <td className="px-4 py-3">
                      {overdue ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                          <AlertCircle className="h-3.5 w-3.5" /> Overdue
                        </span>
                      ) : (
                        <span className="text-xs text-success font-medium">Upcoming</span>
                      )}
                    </td>
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
