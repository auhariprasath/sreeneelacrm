import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users, CalendarClock, AlertTriangle, Trophy, TrendingUp,
  Phone, MessageSquare, Plus, BellPlus, PhoneCall, BarChart3,
  Sparkles, RefreshCw, ListTodo,
} from "lucide-react";
import { formatDateIN, formatTimeOfDay } from "@/lib/format";
import { useDashboardRealtime } from "@/hooks/use-dashboard-realtime";

interface Props { companyId: string }

interface Data {
  totalLeads: number;
  dueToday: number;
  overdue: number;
  closedWon: number;
  conversionPct: number;
  conversionTarget: number;
  followUps: Array<{
    id: string; lead_id: string; full_name: string;
    scheduled_at: string; channel: string; overdue: boolean;
  }>;
  recentLeads: Array<{
    id: string; full_name: string; status: string;
    source: string | null; created_at: string;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  positive: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  contacted: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  won: "bg-emerald-100 text-emerald-700",
  lost: "bg-rose-100 text-rose-700",
};

function statusLabel(s: string) {
  return s.replace(/_/g, " ");
}

async function loadData(companyId: string): Promise<Data> {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const now = new Date().toISOString();

  const [totalLeadsRes, dueTodayRes, overdueRes, recentLeadsRes, followUpsRes, wlRes] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).is("deleted_at", null),
    supabase.from("follow_ups").select("id, leads!inner(company_id)", { count: "exact", head: true })
      .eq("leads.company_id", companyId).eq("is_sent", false).eq("is_cancelled", false)
      .gte("scheduled_at", todayStart.toISOString()).lte("scheduled_at", todayEnd.toISOString()),
    supabase.from("follow_ups").select("id, leads!inner(company_id)", { count: "exact", head: true })
      .eq("leads.company_id", companyId).eq("is_sent", false).eq("is_cancelled", false)
      .lt("scheduled_at", todayStart.toISOString()),
    supabase.from("leads")
      .select("id, full_name, status, source, created_at")
      .eq("company_id", companyId).is("deleted_at", null)
      .order("created_at", { ascending: false }).limit(7),
    supabase.from("follow_ups")
      .select("id, lead_id, channel, scheduled_at, leads!inner(full_name, company_id)")
      .eq("leads.company_id", companyId).eq("is_sent", false).eq("is_cancelled", false)
      .order("scheduled_at", { ascending: true }).limit(5),
    supabase.from("win_loss_log").select("outcome, leads!inner(company_id)")
      .eq("leads.company_id", companyId),
  ]);

  const wlRows = (wlRes.data ?? []) as Array<{ outcome: string }>;
  const won = wlRows.filter((r) => r.outcome === "won").length;
  const conversionPct = wlRows.length ? Math.round((won / wlRows.length) * 100) : 0;

  return {
    totalLeads: totalLeadsRes.count ?? 0,
    dueToday: dueTodayRes.count ?? 0,
    overdue: overdueRes.count ?? 0,
    closedWon: won,
    conversionPct,
    conversionTarget: 25,
    followUps: ((followUpsRes.data ?? []) as any[]).map((f) => ({
      id: f.id,
      lead_id: f.lead_id,
      full_name: f.leads?.full_name ?? "—",
      scheduled_at: f.scheduled_at,
      channel: f.channel ?? "call",
      overdue: new Date(f.scheduled_at) < new Date(now),
    })),
    recentLeads: (recentLeadsRes.data ?? []) as any,
  };
}

function StatCard({
  label, value, sub, icon: Icon, tone = "default",
}: {
  label: string; value: string | number; sub: string;
  icon: any; tone?: "default" | "warning" | "danger" | "success" | "primary";
}) {
  const toneClass = {
    default: "text-muted-foreground",
    warning: "text-amber-600",
    danger: "text-rose-600",
    success: "text-emerald-600",
    primary: "text-primary",
  }[tone];
  return (
    <Card className="h-full">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-3xl font-bold">{value}</div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1 truncate">{label}</div>
            <div className="text-[11px] text-muted-foreground mt-2">{sub}</div>
          </div>
          <div className={`h-8 w-8 rounded-lg bg-accent flex items-center justify-center shrink-0 ${toneClass}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function relTime(iso: string) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dDay = new Date(d); dDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - dDay.getTime()) / 86400000);
  if (diffDays === 0) return `Today at ${formatTimeOfDay(d.toTimeString().slice(0, 5))}`;
  if (diffDays === -1) return `Tomorrow at ${formatTimeOfDay(d.toTimeString().slice(0, 5))}`;
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return `${formatDateIN(d.toISOString().slice(0, 10))}, ${formatTimeOfDay(d.toTimeString().slice(0, 5))}`;
}

export function CompanyOverviewView({ companyId }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    loadData(companyId).then((d) => { setData(d); setLoading(false); });
  }, [companyId]);

  useEffect(() => { setLoading(true); refresh(); }, [refresh]);
  useDashboardRealtime(["leads", "follow_ups", "win_loss_log"], refresh);

  if (loading || !data) {
    return <div className="text-sm text-muted-foreground py-10 text-center">Loading dashboard…</div>;
  }

  return (
    <div className="space-y-5">
      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard label="Total Leads" value={data.totalLeads} sub="leads" icon={Users} tone="primary" />
        <StatCard label="Due Today" value={data.dueToday} sub="tasks" icon={CalendarClock} tone="warning" />
        <StatCard label="Overdue" value={data.overdue} sub="tasks" icon={AlertTriangle} tone="danger" />
        <StatCard label="Closed Won" value={data.closedWon} sub="deals" icon={Trophy} tone="success" />
        <Card className="h-full">
          <CardContent className="p-5">
            <div className="text-3xl font-bold flex items-center gap-2">
              {data.conversionPct.toFixed(1)}%
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">Conversion %</div>
            <Progress value={Math.min(100, (data.conversionPct / data.conversionTarget) * 100)} className="h-1.5 mt-3" />
            <div className="text-[11px] text-muted-foreground mt-1.5">Target: {data.conversionTarget}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Three-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Upcoming Follow-ups */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Upcoming Follow-ups</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.followUps.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-500/5 dark:border-emerald-500/20 p-5 text-center">
                <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">✓ No Overdue Items</div>
                <div className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-2">🎉 Great job! All follow-ups are on track.</div>
              </div>
            ) : data.followUps.map((f) => (
              <Link key={f.id} to="/leads/$leadId" params={{ leadId: f.lead_id }}
                className={`block rounded-lg border p-3 hover:bg-accent/30 transition-colors ${
                  f.overdue ? "border-rose-200 bg-rose-50/50 dark:bg-rose-500/5 dark:border-rose-500/20" : ""
                }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Phone className="h-3 w-3" /> {f.channel}
                  </Badge>
                  {f.overdue && <Badge className="text-[10px] bg-rose-500 hover:bg-rose-500">Overdue</Badge>}
                </div>
                <div className="text-sm font-medium truncate">Follow up with {f.full_name}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" /> {relTime(f.scheduled_at)}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Recent Leads */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Leads</CardTitle>
            <Link to="/leads" search={{ company: companyId }} className="text-xs text-primary hover:underline">View All →</Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentLeads.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">No leads yet.</div>
            ) : data.recentLeads.map((l) => {
              const ageDays = Math.max(0, Math.round((Date.now() - new Date(l.created_at).getTime()) / 86400000));
              return (
                <div key={l.id} className="flex items-center justify-between gap-2 rounded-lg border p-3 hover:bg-accent/30 transition-colors">
                  <Link to="/leads/$leadId" params={{ leadId: l.id }} className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{l.full_name}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[l.status] ?? "bg-muted text-muted-foreground"}`}>
                        {statusLabel(l.status)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {l.source ?? "—"} · {ageDays === 0 ? "today" : `${ageDays} day${ageDays > 1 ? "s" : ""} ago`}
                      </span>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MessageSquare className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Phone className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Right column: Quick Actions + AI Insights */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Link to="/leads/new" search={{ company: companyId }}>
                <Button className="w-full justify-start gap-2"><Plus className="h-4 w-4" /> Add New Lead</Button>
              </Link>
              <Button variant="outline" className="w-full justify-start gap-2"><BellPlus className="h-4 w-4" /> Add Reminder</Button>
              <Button variant="outline" className="w-full justify-start gap-2"><PhoneCall className="h-4 w-4" /> Log Call</Button>
              <Button variant="outline" className="w-full justify-start gap-2"><MessageSquare className="h-4 w-4" /> Send WhatsApp</Button>
              <Link to="/reports" search={{ company: companyId }}>
                <Button variant="outline" className="w-full justify-start gap-2"><BarChart3 className="h-4 w-4" /> View Reports</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-accent flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <CardTitle className="text-base">AI Insights</CardTitle>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refresh}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-accent/40 p-5 text-center">
                <div className="h-10 w-10 rounded-full bg-background mx-auto flex items-center justify-center mb-3">
                  <ListTodo className="h-5 w-5 text-primary" />
                </div>
                <div className="text-sm font-semibold">Unlock AI Insights</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Discover patterns, get forecasts, and receive actionable recommendations.
                </div>
                <Button size="sm" className="mt-3 gap-1"><Sparkles className="h-3.5 w-3.5" /> Analyze My Data</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
