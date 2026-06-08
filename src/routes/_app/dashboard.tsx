import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { Users, ClipboardList, CalendarClock, IndianRupee, ListTodo, Inbox, CheckCircle2, UserCheck } from "lucide-react";
import { DashboardSkeleton } from "@/components/skeleton-dashboard";
import { formatINR, formatDateIN, formatTimeOfDay } from "@/lib/format";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardRealtime } from "@/hooks/use-dashboard-realtime";
import { SuperAdminDashboard } from "@/components/dashboard/super-admin-dashboard";

export const Route = createFileRoute("/_app/dashboard")({ component: DashboardPage });

function StatCard({ label, value, icon: Icon, hint, clickable }: { label: string; value: string | number; icon: any; hint?: string; clickable?: boolean }) {
  return (
    <Card className={clickable ? "transition-colors hover:bg-accent/40 cursor-pointer h-full" : "h-full"}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold mt-1">{value}</div>
            {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
          </div>
          <div className="h-10 w-10 rounded-lg bg-accent text-accent-foreground flex items-center justify-center">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyList({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 text-muted-foreground">
      <Icon className="h-8 w-8 mb-2 opacity-50" />
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="text-xs mt-1">{desc}</div>
    </div>
  );
}

interface CompanyStats {
  newToday: number;
  active: number;
  bookings: number;
  followUps: number;
  upcoming: Array<{ id: string; lead_id: string; event_date: string; start_time: string; full_name: string }>;
  taskCompletionPct: number;
  tasksTotal: number;
  tasksDone: number;
  vendorsConfirmedPct: number;
  vendorsTotal: number;
  vendorsConfirmed: number;
}

async function loadCompanyStats(companyId: string): Promise<CompanyStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const today = new Date().toISOString().slice(0, 10);
  const in14 = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);

  const upcomingBookingsRes = await supabase.from("bookings")
    .select("id")
    .eq("company_id", companyId).is("deleted_at", null).eq("status", "confirmed")
    .gte("event_date", today).lte("event_date", in14);
  const upcomingBookingIds = (upcomingBookingsRes.data ?? []).map((b: any) => b.id);


  const [leadsToday, activeLeads, bookings, followUps, upcoming, tasksAgg, vendorsAgg] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).is("deleted_at", null)
      .gte("created_at", todayStart.toISOString()),
    supabase.from("leads").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).is("deleted_at", null)
      .in("status", ["new", "in_progress", "positive"]),
    supabase.from("requirements").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).is("deleted_at", null).eq("status", "complete"),
    supabase.from("follow_ups").select("id, lead_id, leads!inner(company_id)", { count: "exact", head: true })
      .eq("leads.company_id", companyId).eq("is_sent", false).eq("is_cancelled", false),
    supabase.from("requirements")
      .select("id, lead_id, event_date, start_time, leads!inner(full_name, company_id)")
      .eq("company_id", companyId).is("deleted_at", null)
      .gte("event_date", today).order("event_date", { ascending: true }).limit(5),
    upcomingBookingIds.length
      ? supabase.from("tasks").select("status").eq("company_id", companyId).is("deleted_at", null).in("booking_id", upcomingBookingIds)
      : Promise.resolve({ data: [] as any[] }),
    upcomingBookingIds.length
      ? supabase.from("booking_vendors").select("confirmed").eq("company_id", companyId).in("booking_id", upcomingBookingIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const taskRows = (tasksAgg.data ?? []) as Array<{ status: string }>;
  const tasksTotal = taskRows.length;
  const tasksDone = taskRows.filter((t) => t.status === "done").length;
  const vendorRows = (vendorsAgg.data ?? []) as Array<{ confirmed: boolean }>;
  const vendorsTotal = vendorRows.length;
  const vendorsConfirmed = vendorRows.filter((v) => v.confirmed).length;

  return {
    newToday: leadsToday.count ?? 0,
    active: activeLeads.count ?? 0,
    bookings: bookings.count ?? 0,
    followUps: followUps.count ?? 0,
    upcoming: (upcoming.data ?? []).map((r: any) => ({
      id: r.id, lead_id: r.lead_id, event_date: r.event_date, start_time: r.start_time,
      full_name: r.leads?.full_name ?? "—",
    })),
    tasksTotal,
    tasksDone,
    taskCompletionPct: tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0,
    vendorsTotal,
    vendorsConfirmed,
    vendorsConfirmedPct: vendorsTotal ? Math.round((vendorsConfirmed / vendorsTotal) * 100) : 0,
  };
}

function DashboardPage() {
  const { role, loading, activeCompanyId } = useAuth();
  if (loading) return <DashboardSkeleton />;
  if (role === "super_admin" && activeCompanyId) {
    return <Navigate to="/company-dashboard/$companyId" params={{ companyId: activeCompanyId }} replace />;
  }
  if (role === "super_admin") return <SuperAdminDashboard />;
  return <CompanyDashboard />;
}

function CompanyDashboard() {
  const { role, companies, profile, activeCompanyId } = useAuth();
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const companyId = role === "super_admin"
    ? (activeCompanyId ?? null)
    : (profile?.company_id ?? companies[0]?.id ?? null);



  const refresh = useCallback(() => {
    if (!companyId) return;
    loadCompanyStats(companyId).then((s) => { setStats(s); setStatsLoading(false); });
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    setStatsLoading(true);
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [companyId, refresh]);

  useDashboardRealtime(
    ["leads", "slots", "requirements", "follow_ups", "tasks", "booking_vendors", "bookings", "payments", "quotations"],
    refresh,
  );

  const greeting = `Welcome, ${profile?.full_name || "there"}`;


  if (statsLoading || !stats) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold">{greeting}</h1>
        <p className="text-sm text-muted-foreground">
          {companies.find((c) => c.id === companyId)?.name ?? "Your company"} overview
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/leads"
          search={{ filter: "new" as const, company: companyId ?? undefined }}
          className="block focus:outline-none focus:ring-2 focus:ring-ring rounded-lg"
        >
          <StatCard label="New enquiries today" value={stats.newToday} icon={Users} clickable />
        </Link>
        <Link to="/leads" search={{ company: companyId ?? undefined }} className="block focus:outline-none focus:ring-2 focus:ring-ring rounded-lg">
          <StatCard label="Open leads" value={stats.active} icon={Users} hint="being worked on" clickable />
        </Link>
        <Link
          to="/bookings"
          search={{ status: "confirmed" as const, company: companyId ?? undefined }}
          className="block focus:outline-none focus:ring-2 focus:ring-ring rounded-lg"
        >
          <StatCard label="Confirmed bookings" value={stats.bookings} icon={ClipboardList} clickable />
        </Link>
        <Link
          to="/leads"
          search={{ filter: "followup_due" as const, company: companyId ?? undefined }}
          className="block focus:outline-none focus:ring-2 focus:ring-ring rounded-lg"
        >
          <StatCard label="Calls to make today" value={stats.followUps} icon={ListTodo} clickable />
        </Link>
      </div>



      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">


        <Card>
          <CardHeader><CardTitle className="text-base">Upcoming events</CardTitle></CardHeader>
          <CardContent>
            {stats.upcoming.length === 0 ? (
              <EmptyList icon={CalendarClock} title="Nothing scheduled" desc="Confirmed events will appear here." />
            ) : (
              <ul className="divide-y">
                {stats.upcoming.map((u) => (
                  <li key={u.id} className="py-2 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{u.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateIN(u.event_date)} {u.start_time ? `· ${formatTimeOfDay(u.start_time)}` : ""}
                      </div>
                    </div>
                    <Link to="/leads/$leadId" params={{ leadId: u.lead_id }} className="text-xs text-primary underline">Open</Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Event readiness (next 14 days)</CardTitle>
          <CardDescription>
            {stats.tasksTotal + stats.vendorsTotal === 0
              ? "No upcoming confirmed bookings"
              : "Across upcoming confirmed bookings"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Tasks completed
              </div>
              <span className="text-sm font-semibold">{stats.taskCompletionPct}%</span>
            </div>
            <div className="h-2 rounded bg-muted overflow-hidden">
              <div className="h-full bg-success transition-all" style={{ width: `${stats.taskCompletionPct}%` }} />
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {stats.tasksDone} of {stats.tasksTotal} tasks done
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <UserCheck className="h-4 w-4 text-info" />
                Vendors confirmed
              </div>
              <span className="text-sm font-semibold">{stats.vendorsConfirmedPct}%</span>
            </div>
            <div className="h-2 rounded bg-muted overflow-hidden">
              <div className="h-full bg-info transition-all" style={{ width: `${stats.vendorsConfirmedPct}%` }} />
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {stats.vendorsConfirmed} of {stats.vendorsTotal} vendor assignments confirmed
            </div>
          </div>
        </CardContent>
      </Card>



    </div>
  );
}

