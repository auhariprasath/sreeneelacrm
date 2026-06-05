import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { IndianRupee, Users, ClipboardList, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { formatINR } from "@/lib/format";

interface Stats {
  revenue: number;
  enquiries: number;
  bookings: number;
  conversion: number;
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  return { start, end };
}

async function loadStats(): Promise<Stats> {
  const { start, end } = monthRange();
  const [pay, leads, bks, wl] = await Promise.all([
    supabase.from("payments").select("amount").eq("status", "paid").gte("received_at", start).lt("received_at", end),
    supabase.from("leads").select("id", { count: "exact", head: true }).is("deleted_at", null).gte("created_at", start).lt("created_at", end),
    supabase.from("bookings").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "confirmed").gte("created_at", start).lt("created_at", end),
    supabase.from("win_loss_log").select("outcome").gte("closed_at", start).lt("closed_at", end),
  ]);
  const revenue = (pay.data ?? []).reduce((s, p: any) => s + Number(p.amount ?? 0), 0);
  const wlRows = (wl.data ?? []) as Array<{ outcome: string }>;
  const won = wlRows.filter((r) => r.outcome === "won").length;
  const total = wlRows.length;
  return {
    revenue,
    enquiries: leads.count ?? 0,
    bookings: bks.count ?? 0,
    conversion: total ? Math.round((won / total) * 100) : 0,
  };
}

function Tile({ label, value, icon: Icon, to, hint }: { label: string; value: string; icon: any; to: string; hint?: string }) {
  return (
    <Link to={to} className="block focus:outline-none focus:ring-2 focus:ring-ring rounded-xl">
      <Card className="transition-colors hover:bg-accent/40 h-full">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">{label}</div>
              <div className="text-xl sm:text-2xl font-semibold mt-1">{value}</div>
              {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
            </div>
            <div className="h-9 w-9 rounded-lg bg-accent text-accent-foreground flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function StatsRow() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => loadStats().then((r) => { if (!cancelled) setS(r); });
    refresh();
    const ch = supabase.channel("dash-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "win_loss_log" }, refresh)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);

  const v = s ?? { revenue: 0, enquiries: 0, bookings: 0, conversion: 0 };
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <Tile label="Revenue this month" value={formatINR(v.revenue)} icon={IndianRupee} to="/bookings" />
      <Tile label="New enquiries" value={String(v.enquiries)} icon={Users} to="/leads" />
      <Tile label="Bookings" value={String(v.bookings)} icon={ClipboardList} to="/bookings" />
      <Tile label="Conversion rate" value={`${v.conversion}%`} icon={TrendingUp} to="/reports" hint="Won / closed" />
    </div>
  );
}
