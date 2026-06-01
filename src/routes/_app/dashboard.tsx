import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, ClipboardList, CalendarClock, AlertCircle, IndianRupee, ListTodo, Inbox, Clock, CheckCircle2, UserCheck } from "lucide-react";
import { DashboardSkeleton } from "@/components/skeleton-dashboard";
import { formatINR, formatDateIN, formatTimeOfDay } from "@/lib/format";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/dashboard")({ component: DashboardPage });

function StatCard({ label, value, icon: Icon, hint }: { label: string; value: string | number; icon: any; hint?: string }) {
  return (
    <Card>
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

interface ExpiringHold {
  id: string; lead_id: string | null; event_date: string;
  start_time: string; end_time: string; held_until: string; full_name: string;
}
interface CompanyStats {
  newToday: number;
  active: number;
  bookings: number;
  followUps: number;
  activeHolds: number;
  upcoming: Array<{ id: string; lead_id: string; event_date: string; start_time: string; full_name: string }>;
  expiringSoon: ExpiringHold[];
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
  const nowIso = new Date().toISOString();
  const tenMin = new Date(Date.now() + 10 * 60_000).toISOString();

  // Get upcoming booking ids in next 14 days for task/vendor stats
  const upcomingBookingsRes = await supabase.from("bookings")
    .select("id")
    .eq("company_id", companyId).is("deleted_at", null).eq("status", "confirmed")
    .gte("event_date", today).lte("event_date", in14);
  const upcomingBookingIds = (upcomingBookingsRes.data ?? []).map((b: any) => b.id);

  const [leadsToday, activeLeads, bookings, followUps, holds, upcoming, expiring, tasksAgg, vendorsAgg] = await Promise.all([
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
    supabase.from("slots").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).eq("status", "soft_hold").gt("held_until", nowIso),
    supabase.from("requirements")
      .select("id, lead_id, event_date, start_time, leads!inner(full_name, company_id)")
      .eq("company_id", companyId).is("deleted_at", null)
      .gte("event_date", today).order("event_date", { ascending: true }).limit(5),
    supabase.from("slots")
      .select("id, held_by_lead_id, event_date, start_time, end_time, held_until, leads:held_by_lead_id(full_name)")
      .eq("company_id", companyId).eq("status", "soft_hold")
      .gt("held_until", nowIso).lt("held_until", tenMin)
      .order("held_until", { ascending: true }).limit(10),
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
    activeHolds: holds.count ?? 0,
    upcoming: (upcoming.data ?? []).map((r: any) => ({
      id: r.id, lead_id: r.lead_id, event_date: r.event_date, start_time: r.start_time,
      full_name: r.leads?.full_name ?? "—",
    })),
    expiringSoon: (expiring.data ?? []).map((s: any) => ({
      id: s.id, lead_id: s.held_by_lead_id, event_date: s.event_date,
      start_time: s.start_time, end_time: s.end_time, held_until: s.held_until,
      full_name: s.leads?.full_name ?? "—",
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
  const { role, companies, profile, loading, activeCompanyId } = useAuth();
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const companyId = role === "super_admin" ? activeCompanyId : companies[0]?.id ?? null;

  useEffect(() => {
    if (role === "super_admin" && !activeCompanyId) { setStatsLoading(false); return; }
    if (!companyId) return;
    setStatsLoading(true);
    let cancelled = false;
    const refresh = () => loadCompanyStats(companyId).then((s) => { if (!cancelled) { setStats(s); setStatsLoading(false); } });
    refresh();
    // Refresh every minute to update "minutes left" on expiring holds
    const interval = setInterval(refresh, 60_000);
    // Realtime: any change to leads/slots/requirements/follow-ups for this company refreshes stats
    const ch = supabase.channel(`dash-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `company_id=eq.${companyId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "slots", filter: `company_id=eq.${companyId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "requirements", filter: `company_id=eq.${companyId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "follow_ups" }, refresh)
      .subscribe();
    return () => { cancelled = true; clearInterval(interval); supabase.removeChannel(ch); };
  }, [companyId, role, activeCompanyId]);

  if (loading) return <DashboardSkeleton />;
  const greeting = `Welcome, ${profile?.full_name || "there"}`;

  if (role === "super_admin" && !activeCompanyId) {
    return (
      <div className="space-y-6 max-w-7xl">
        <div>
          <h1 className="text-2xl font-semibold">{greeting}</h1>
          <p className="text-sm text-muted-foreground">Pick a company from the top bar to see live stats</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {companies.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{c.name}</CardTitle>
                <CardDescription className="capitalize">{c.type} venue</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Switch context to view</CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

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
        <StatCard label="New leads today" value={stats.newToday} icon={Users} />
        <StatCard label="Active leads" value={stats.active} icon={Users} />
        <StatCard label="Bookings" value={stats.bookings} icon={ClipboardList} hint="completed requirements" />
        <StatCard label="Pending follow-ups" value={stats.followUps} icon={ListTodo} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Active soft holds</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {stats.activeHolds === 0 ? (
              <EmptyList icon={Clock} title="No active holds" desc="Soft holds expire after 30 minutes." />
            ) : (
              <div className="text-sm">
                <span className="text-2xl font-semibold">{stats.activeHolds}</span>
                <span className="text-muted-foreground ml-2">slot{stats.activeHolds === 1 ? "" : "s"} held right now</span>
                <Link to="/calendar" className="block mt-3 text-primary text-xs underline">View calendar →</Link>
              </div>
            )}
          </CardContent>
        </Card>

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

      {stats.expiringSoon.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base text-amber-700 dark:text-amber-400">Holds expiring soon</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {stats.expiringSoon.map((h) => {
                const mins = Math.max(0, Math.round((new Date(h.held_until).getTime() - Date.now()) / 60000));
                return (
                  <li key={h.id} className="px-5 py-3 flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{h.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateIN(h.event_date)} · {formatTimeOfDay(h.start_time)}–{formatTimeOfDay(h.end_time)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-400">{mins}m left</span>
                      {h.lead_id && (
                        <Link to="/leads/$leadId" params={{ leadId: h.lead_id }} className="text-xs text-primary underline">Open</Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
