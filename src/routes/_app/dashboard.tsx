import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, ClipboardList, CalendarClock, AlertCircle, ListTodo, Clock,
  ArrowRight, Plus, Sparkles,
} from "lucide-react";
import { DashboardSkeleton } from "@/components/skeleton-dashboard";
import { formatDateIN, formatTimeOfDay } from "@/lib/format";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({ component: DashboardPage });

type Tone = "primary" | "success" | "warning" | "info";

const TONE: Record<Tone, { bg: string; fg: string; ring: string }> = {
  primary: { bg: "bg-primary/10", fg: "text-primary", ring: "ring-primary/20" },
  success: { bg: "bg-success/10", fg: "text-success", ring: "ring-success/20" },
  warning: { bg: "bg-warning/10", fg: "text-warning", ring: "ring-warning/20" },
  info:    { bg: "bg-accent",     fg: "text-accent-foreground", ring: "ring-accent" },
};

function StatCard({
  label, value, icon: Icon, hint, tone = "primary", to,
}: { label: string; value: string | number; icon: any; hint?: string; tone?: Tone; to?: string }) {
  const t = TONE[tone];
  const inner = (
    <Card className={cn("transition-all hover:shadow-md", to && "hover:-translate-y-0.5 cursor-pointer")}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
            <div className="text-3xl font-semibold mt-2 tabular-nums">{value}</div>
            {hint && <div className="text-xs text-muted-foreground mt-1.5">{hint}</div>}
          </div>
          <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center ring-1 shrink-0", t.bg, t.fg, t.ring)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function EmptyList({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground mt-1 max-w-xs">{desc}</div>
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
}

async function loadCompanyStats(companyId: string): Promise<CompanyStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const tenMin = new Date(Date.now() + 10 * 60_000).toISOString();

  const [leadsToday, activeLeads, bookings, followUps, holds, upcoming, expiring] = await Promise.all([
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
  ]);

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
  };
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
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
    const interval = setInterval(refresh, 60_000);
    const ch = supabase.channel(`dash-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `company_id=eq.${companyId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "slots", filter: `company_id=eq.${companyId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "requirements", filter: `company_id=eq.${companyId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "follow_ups" }, refresh)
      .subscribe();
    return () => { cancelled = true; clearInterval(interval); supabase.removeChannel(ch); };
  }, [companyId, role, activeCompanyId]);

  if (loading) return <DashboardSkeleton />;
  const firstName = (profile?.full_name || "there").split(" ")[0];
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  // Super admin without a company selected
  if (role === "super_admin" && !activeCompanyId) {
    return (
      <div className="space-y-6 max-w-7xl">
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-accent to-background border p-6 sm:p-8">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-primary font-medium">
            <Sparkles className="h-3.5 w-3.5" /> Super admin
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-2">{greet()}, {firstName}</h1>
          <p className="text-sm text-muted-foreground mt-1">Pick a company from the top bar to view its live overview.</p>
        </div>
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Your companies</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {companies.map((c) => (
              <Card key={c.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{c.name}</CardTitle>
                  <CardDescription className="capitalize">{c.type} venue</CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">Switch context to view stats</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (statsLoading || !stats) return <DashboardSkeleton />;

  const companyName = companies.find((c) => c.id === companyId)?.name ?? "Your company";

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-accent to-background border p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-primary font-medium">{today}</div>
            <h1 className="text-2xl sm:text-3xl font-semibold mt-1.5">{greet()}, {firstName} 👋</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Here's what's happening at <span className="font-medium text-foreground">{companyName}</span> today.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button asChild variant="outline" size="sm">
              <Link to="/calendar"><CalendarClock className="h-4 w-4" /> Calendar</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/leads"><Plus className="h-4 w-4" /> New lead</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="New today" value={stats.newToday} icon={Users} tone="primary" to="/leads" />
        <StatCard label="Active leads" value={stats.active} icon={Users} tone="info" to="/leads" hint="in progress" />
        <StatCard label="Bookings" value={stats.bookings} icon={ClipboardList} tone="success" to="/bookings" hint="confirmed" />
        <StatCard label="Follow-ups" value={stats.followUps} icon={ListTodo} tone="warning" to="/tasks" hint="pending" />
      </div>

      {/* Two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Active soft holds</CardTitle>
              <CardDescription className="text-xs mt-0.5">Slots reserved for 30 minutes</CardDescription>
            </div>
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {stats.activeHolds === 0 ? (
              <EmptyList icon={Clock} title="No active holds" desc="Soft holds appear here while customers decide." />
            ) : (
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-4xl font-semibold tabular-nums">{stats.activeHolds}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    slot{stats.activeHolds === 1 ? "" : "s"} held right now
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/calendar">View calendar <ArrowRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Upcoming events</CardTitle>
              <CardDescription className="text-xs mt-0.5">Next confirmed bookings</CardDescription>
            </div>
            <div className="h-9 w-9 rounded-lg bg-success/10 text-success flex items-center justify-center">
              <CalendarClock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {stats.upcoming.length === 0 ? (
              <EmptyList icon={CalendarClock} title="Nothing scheduled" desc="Confirmed events will appear here." />
            ) : (
              <ul className="divide-y">
                {stats.upcoming.map((u) => (
                  <li key={u.id}>
                    <Link
                      to="/leads/$leadId"
                      params={{ leadId: u.lead_id }}
                      className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-accent text-accent-foreground flex flex-col items-center justify-center shrink-0">
                          <div className="text-[10px] uppercase leading-none">
                            {new Date(u.event_date).toLocaleDateString("en-IN", { month: "short" })}
                          </div>
                          <div className="text-sm font-semibold leading-tight">
                            {new Date(u.event_date).getDate()}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{u.full_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateIN(u.event_date)}{u.start_time ? ` · ${formatTimeOfDay(u.start_time)}` : ""}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expiring holds alert */}
      {stats.expiringSoon.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-warning/15 text-warning flex items-center justify-center">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Holds expiring soon</CardTitle>
                <CardDescription className="text-xs mt-0.5">Act before these slots auto-release</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="bg-warning/15 text-warning border-0">
              {stats.expiringSoon.length}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-warning/10">
              {stats.expiringSoon.map((h) => {
                const mins = Math.max(0, Math.round((new Date(h.held_until).getTime() - Date.now()) / 60000));
                return (
                  <li key={h.id} className="px-6 py-3 flex items-center justify-between text-sm gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{h.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateIN(h.event_date)} · {formatTimeOfDay(h.start_time)}–{formatTimeOfDay(h.end_time)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="border-warning/40 text-warning bg-background tabular-nums">
                        {mins}m left
                      </Badge>
                      {h.lead_id && (
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/leads/$leadId" params={{ leadId: h.lead_id }}>
                            Open <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
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
