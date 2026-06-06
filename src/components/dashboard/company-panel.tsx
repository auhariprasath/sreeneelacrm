import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatDateIN, formatTimeOfDay } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useDashboardRealtime } from "@/hooks/use-dashboard-realtime";

interface Props {
  companyId: string;
  companyName: string;
  brandColor: string;
}

interface Overview {
  revenue: number;
  newLeads: number;
  bookings: number;
  conversion: number;
  daily: Array<{ day: string; revenue: number }>;
}

interface Pending {
  leads: Array<{ id: string; full_name: string; status: string; created_at: string }>;
  quotations: Array<{ id: string; lead_id: string; quotation_number: string; total: number; status: string }>;
  bookings: Array<{ id: string; lead_id: string; full_name: string; event_date: string; total: number; paid: number }>;
  upcoming: Array<{ id: string; lead_id: string; full_name: string; event_date: string; start_time: string | null }>;
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

async function loadOverview(companyId: string): Promise<Overview> {
  const { start, end } = monthRange();
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const [pay, leads, bks, wl] = await Promise.all([
    supabase.from("payments").select("amount, received_at, bookings!inner(company_id)")
      .eq("status", "received").eq("bookings.company_id", companyId)
      .gte("received_at", startIso).lt("received_at", endIso),
    supabase.from("leads").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).is("deleted_at", null)
      .gte("created_at", startIso).lt("created_at", endIso),
    supabase.from("bookings").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).is("deleted_at", null).eq("status", "confirmed")
      .gte("created_at", startIso).lt("created_at", endIso),
    supabase.from("win_loss_log").select("outcome, leads!inner(company_id)")
      .eq("leads.company_id", companyId).gte("closed_at", startIso).lt("closed_at", endIso),
  ]);
  const payRows = (pay.data ?? []) as Array<{ amount: number; received_at: string }>;
  const revenue = payRows.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const days = end.getDate() === 1 ? new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate() : 0;
  const totalDays = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const dailyMap = new Map<string, number>();
  for (let d = 1; d <= totalDays; d++) dailyMap.set(String(d), 0);
  payRows.forEach((p) => {
    const dt = new Date(p.received_at);
    const k = String(dt.getDate());
    dailyMap.set(k, (dailyMap.get(k) ?? 0) + Number(p.amount ?? 0));
  });
  const wlRows = (wl.data ?? []) as Array<{ outcome: string }>;
  const won = wlRows.filter((r) => r.outcome === "won").length;
  return {
    revenue,
    newLeads: leads.count ?? 0,
    bookings: bks.count ?? 0,
    conversion: wlRows.length ? Math.round((won / wlRows.length) * 100) : 0,
    daily: Array.from(dailyMap.entries()).map(([day, revenue]) => ({ day, revenue })),
  };
}

async function loadPending(companyId: string): Promise<Pending> {
  const today = new Date().toISOString().slice(0, 10);
  const [leads, quots, bks, upcoming] = await Promise.all([
    supabase.from("leads")
      .select("id, full_name, status, created_at")
      .eq("company_id", companyId).is("deleted_at", null)
      .in("status", ["new", "in_progress", "positive"])
      .order("created_at", { ascending: false }).limit(20),
    supabase.from("quotations")
      .select("id, lead_id, quotation_number, total, status")
      .eq("company_id", companyId).is("deleted_at", null)
      .in("status", ["sent", "draft"]).order("created_at", { ascending: false }).limit(20),
    supabase.from("bookings")
      .select("id, lead_id, event_date, total_amount, amount_paid, leads(full_name)")
      .eq("company_id", companyId).is("deleted_at", null).eq("status", "confirmed")
      .gte("event_date", today).order("event_date", { ascending: true }).limit(20),
    supabase.from("bookings")
      .select("id, lead_id, event_date, start_time, leads(full_name)")
      .eq("company_id", companyId).is("deleted_at", null).eq("status", "confirmed")
      .gte("event_date", today).order("event_date", { ascending: true }).limit(20),
  ]);
  return {
    leads: (leads.data ?? []) as any,
    quotations: (quots.data ?? []) as any,
    bookings: ((bks.data ?? []) as any[]).map((b) => ({
      id: b.id, lead_id: b.lead_id, full_name: b.leads?.full_name ?? "—",
      event_date: b.event_date, total: Number(b.total_amount ?? 0), paid: Number(b.amount_paid ?? 0),
    })),
    upcoming: ((upcoming.data ?? []) as any[]).map((b) => ({
      id: b.id, lead_id: b.lead_id, full_name: b.leads?.full_name ?? "—",
      event_date: b.event_date, start_time: b.start_time,
    })),
  };
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">{label}</div>
      <div className="text-lg font-semibold mt-1 truncate">{value}</div>
    </div>
  );
}

function Column({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-lg border bg-card min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="text-xs font-medium">{title}</div>
        <Badge variant="secondary" className="text-[10px]">{count}</Badge>
      </div>
      <ScrollArea className="h-[260px]">
        <div className="p-2 space-y-2">{children}</div>
      </ScrollArea>
    </div>
  );
}

export function CompanyPanel({ companyId, companyName, brandColor }: Props) {
  const [tab, setTab] = useState<"overview" | "pending">("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const refresh = useCallback(async () => {
    const [o, p] = await Promise.all([loadOverview(companyId), loadPending(companyId)]);
    setOverview(o); setPending(p);
  }, [companyId]);

  useEffect(() => { refresh(); }, [refresh]);
  useDashboardRealtime(
    ["leads", "bookings", "quotations", "payments", "win_loss_log"],
    refresh,
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-3 w-3 rounded-full shrink-0" style={{ background: brandColor }} />
          <CardTitle className="text-base truncate">{companyName}</CardTitle>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="h-8">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs">Pending works</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {tab === "overview" ? (
          !overview ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatTile label="Revenue (mo)" value={formatINR(overview.revenue)} />
                <StatTile label="New leads" value={String(overview.newLeads)} />
                <StatTile label="Bookings" value={String(overview.bookings)} />
                <StatTile label="Conversion" value={`${overview.conversion}%`} />
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.daily}>
                    <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={10} interval={3} />
                    <YAxis tickLine={false} axisLine={false} fontSize={10} width={36} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
                    <Tooltip formatter={(v: any) => formatINR(Number(v))} labelFormatter={(l) => `Day ${l}`} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                    <Bar dataKey="revenue" fill={brandColor} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )
        ) : (
          !pending ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <Column title="Open leads" count={pending.leads.length}>
                {pending.leads.length === 0 ? <div className="text-xs text-muted-foreground p-2">None</div> : pending.leads.map((l) => (
                  <Link key={l.id} to="/leads/$leadId" params={{ leadId: l.id }} className="block rounded border p-2 hover:bg-accent/40">
                    <div className="text-sm font-medium truncate">{l.full_name}</div>
                    <div className="text-[11px] text-muted-foreground">{l.status} · {formatDateIN(l.created_at)}</div>
                  </Link>
                ))}
              </Column>
              <Column title="Quotations" count={pending.quotations.length}>
                {pending.quotations.length === 0 ? <div className="text-xs text-muted-foreground p-2">None</div> : pending.quotations.map((q) => (
                  <Link key={q.id} to="/leads/$leadId" params={{ leadId: q.lead_id }} className="block rounded border p-2 hover:bg-accent/40">
                    <div className="text-sm font-medium truncate">{q.quotation_number}</div>
                    <div className="text-[11px] text-muted-foreground">{q.status} · {formatINR(Number(q.total))}</div>
                  </Link>
                ))}
              </Column>
              <Column title="Bookings (payments)" count={pending.bookings.length}>
                {pending.bookings.length === 0 ? <div className="text-xs text-muted-foreground p-2">None</div> : pending.bookings.map((b) => {
                  const pct = b.total > 0 ? Math.min(100, Math.round((b.paid / b.total) * 100)) : 0;
                  return (
                    <Link key={b.id} to="/leads/$leadId" params={{ leadId: b.lead_id }} className="block rounded border p-2 hover:bg-accent/40 space-y-1">
                      <div className="text-sm font-medium truncate">{b.full_name}</div>
                      <div className="text-[11px] text-muted-foreground">{formatDateIN(b.event_date)} · {formatINR(b.paid)}/{formatINR(b.total)}</div>
                      <Progress value={pct} className="h-1" />
                    </Link>
                  );
                })}
              </Column>
              <Column title="Upcoming events" count={pending.upcoming.length}>
                {pending.upcoming.length === 0 ? <div className="text-xs text-muted-foreground p-2">None</div> : pending.upcoming.map((u) => (
                  <Link key={u.id} to="/leads/$leadId" params={{ leadId: u.lead_id }} className="block rounded border p-2 hover:bg-accent/40">
                    <div className="text-sm font-medium truncate">{u.full_name}</div>
                    <div className="text-[11px] text-muted-foreground">{formatDateIN(u.event_date)}{u.start_time ? ` · ${formatTimeOfDay(u.start_time)}` : ""}</div>
                  </Link>
                ))}
              </Column>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
