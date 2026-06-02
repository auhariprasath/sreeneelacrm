import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardSkeleton } from "@/components/skeleton-dashboard";
import { formatINR } from "@/lib/format";
import { Download, TrendingUp, TrendingDown, Star, IndianRupee, Trophy } from "lucide-react";

export const Route = createFileRoute("/_app/reports")({ component: ReportsPage });

interface ReportData {
  won: number;
  lost: number;
  wonValue: number;
  lostValue: number;
  conversionPct: number;
  avgRating: number;
  ratingCount: number;
  completedBookings: number;
  totalRevenue: number;
  dropReasons: Array<{ reason: string; count: number }>;
  competitors: Array<{ name: string; count: number; value: number }>;
  ratingDist: Array<{ stars: number; count: number }>;
}

function toCsv(rows: Array<Record<string, any>>): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const { role, companies, activeCompanyId, loading } = useAuth();
  const companyId = role === "super_admin" ? activeCompanyId : companies[0]?.id ?? null;

  const today = new Date().toISOString().slice(0, 10);
  const lastMonth = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(lastMonth);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<ReportData | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!companyId) { setBusy(false); return; }
    let cancelled = false;
    setBusy(true);
    (async () => {
      const fromIso = new Date(from).toISOString();
      const toIso = new Date(new Date(to).getTime() + 86400_000).toISOString();
      const [wl, fb, bk] = await Promise.all([
        supabase.from("win_loss_log").select("outcome, amount_value, drop_reason, competitor_name")
          .eq("company_id", companyId).gte("closed_at", fromIso).lte("closed_at", toIso),
        supabase.from("feedback").select("rating")
          .eq("company_id", companyId).gte("submitted_at", fromIso).lte("submitted_at", toIso),
        supabase.from("bookings").select("total_amount, completed_at")
          .eq("company_id", companyId).is("deleted_at", null).eq("status", "completed")
          .gte("completed_at", fromIso).lte("completed_at", toIso),
      ]);

      const wlRows = (wl.data ?? []) as Array<{ outcome: string; amount_value: number | null; drop_reason: string | null; competitor_name: string | null }>;
      const won = wlRows.filter((r) => r.outcome === "won");
      const lost = wlRows.filter((r) => r.outcome === "lost");
      const wonValue = won.reduce((s, r) => s + Number(r.amount_value || 0), 0);
      const lostValue = lost.reduce((s, r) => s + Number(r.amount_value || 0), 0);
      const total = won.length + lost.length;

      const reasons = new Map<string, number>();
      lost.forEach((r) => {
        const k = (r.drop_reason || "Unspecified").trim();
        reasons.set(k, (reasons.get(k) ?? 0) + 1);
      });
      const compMap = new Map<string, { count: number; value: number }>();
      lost.forEach((r) => {
        if (!r.competitor_name) return;
        const k = r.competitor_name.trim();
        const cur = compMap.get(k) ?? { count: 0, value: 0 };
        cur.count += 1;
        cur.value += Number(r.amount_value || 0);
        compMap.set(k, cur);
      });

      const fbRows = (fb.data ?? []) as Array<{ rating: number }>;
      const avgRating = fbRows.length ? fbRows.reduce((s, r) => s + r.rating, 0) / fbRows.length : 0;
      const dist = [1, 2, 3, 4, 5].map((s) => ({ stars: s, count: fbRows.filter((r) => r.rating === s).length }));

      const bkRows = (bk.data ?? []) as Array<{ total_amount: number }>;
      const totalRevenue = bkRows.reduce((s, r) => s + Number(r.total_amount || 0), 0);

      if (cancelled) return;
      setData({
        won: won.length, lost: lost.length, wonValue, lostValue,
        conversionPct: total ? Math.round((won.length / total) * 100) : 0,
        avgRating, ratingCount: fbRows.length,
        completedBookings: bkRows.length, totalRevenue,
        dropReasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
        competitors: [...compMap.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.count - a.count),
        ratingDist: dist,
      });
      setBusy(false);
    })();
    return () => { cancelled = true; };
  }, [companyId, from, to]);

  if (loading) return <DashboardSkeleton />;

  if (role === "super_admin" && !activeCompanyId) {
    return (
      <div className="max-w-7xl space-y-4">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">Pick a company from the top bar to view its reports.</p>
      </div>
    );
  }

  const exportAll = () => {
    if (!data) return;
    const rows = [
      { metric: "Won", count: data.won, value: data.wonValue },
      { metric: "Lost", count: data.lost, value: data.lostValue },
      { metric: "Conversion %", count: data.conversionPct, value: "" },
      { metric: "Avg rating", count: data.avgRating.toFixed(2), value: data.ratingCount },
      { metric: "Completed bookings", count: data.completedBookings, value: data.totalRevenue },
    ];
    downloadCsv(`report-${from}-to-${to}.csv`, toCsv(rows));
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">Performance analytics for selected date range</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
          </div>
          <Button variant="outline" size="sm" onClick={exportAll} disabled={!data}>
            <Download className="h-4 w-4 mr-2" />Export CSV
          </Button>
        </div>
      </div>

      {busy || !data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/bookings" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
              <Card className="transition hover:bg-accent/40 cursor-pointer h-full"><CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Conversion</div>
                    <div className="text-2xl font-semibold mt-1">{data.conversionPct}%</div>
                    <div className="text-xs text-muted-foreground mt-1">{data.won} won · {data.lost} lost</div>
                  </div>
                  <Trophy className="h-8 w-8 text-emerald-600" />
                </div>
              </CardContent></Card>
            </Link>
            <Link to="/bookings" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
              <Card className="transition hover:bg-accent/40 cursor-pointer h-full"><CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Won value</div>
                    <div className="text-2xl font-semibold mt-1">{formatINR(data.wonValue)}</div>
                  </div>
                  <TrendingUp className="h-8 w-8 text-emerald-600" />
                </div>
              </CardContent></Card>
            </Link>
            <Link to="/command-centre" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
              <Card className="transition hover:bg-accent/40 cursor-pointer h-full"><CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Lost value</div>
                    <div className="text-2xl font-semibold mt-1">{formatINR(data.lostValue)}</div>
                  </div>
                  <TrendingDown className="h-8 w-8 text-rose-600" />
                </div>
              </CardContent></Card>
            </Link>
            <Card><CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Avg rating</div>
                  <div className="text-2xl font-semibold mt-1">
                    {data.avgRating > 0 ? data.avgRating.toFixed(1) : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{data.ratingCount} response{data.ratingCount === 1 ? "" : "s"}</div>
                </div>
                <Star className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent></Card>
          </div>


          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Completed events</CardTitle>
                <CardDescription>Revenue from completed bookings in range</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-semibold">{formatINR(data.totalRevenue)}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{data.completedBookings} event{data.completedBookings === 1 ? "" : "s"}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Rating distribution</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.ratingDist.slice().reverse().map((r) => {
                  const pct = data.ratingCount ? Math.round((r.count / data.ratingCount) * 100) : 0;
                  return (
                    <div key={r.stars} className="flex items-center gap-3 text-sm">
                      <span className="w-10 text-muted-foreground">{r.stars}★</span>
                      <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                        <div className="h-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs text-muted-foreground">{r.count}</span>
                    </div>
                  );
                })}
                {data.ratingCount === 0 && <div className="text-xs text-muted-foreground py-2">No feedback yet</div>}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Top drop reasons</CardTitle>
                {data.dropReasons.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => downloadCsv(`drop-reasons-${from}-to-${to}.csv`, toCsv(data.dropReasons))}>
                    <Download className="h-3 w-3 mr-1" />CSV
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {data.dropReasons.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">No losses recorded</div>
                ) : (
                  <ul className="divide-y text-sm">
                    {data.dropReasons.slice(0, 8).map((r) => (
                      <li key={r.reason}>
                        <Link
                          to="/command-centre"
                          className="py-2 flex items-center justify-between gap-2 hover:bg-accent/40 rounded px-1 -mx-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="truncate pr-2">{r.reason}</span>
                          <span className="text-xs font-medium text-muted-foreground">{r.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Lost to competitors</CardTitle>
                {data.competitors.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => downloadCsv(`competitors-${from}-to-${to}.csv`, toCsv(data.competitors))}>
                    <Download className="h-3 w-3 mr-1" />CSV
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {data.competitors.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">No competitors named</div>
                ) : (
                  <ul className="divide-y text-sm">
                    {data.competitors.slice(0, 8).map((c) => (
                      <li key={c.name}>
                        <Link
                          to="/command-centre"
                          className="py-2 flex items-center justify-between gap-2 hover:bg-accent/40 rounded px-1 -mx-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="truncate pr-2">{c.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {c.count} · {formatINR(c.value)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <CallOutcomesReport from={from} to={to} companyId={companyId} />
        </>
      )}
    </div>
  );
}

interface CallOutcomeRow {
  id: string;
  lead_id: string;
  performed_by: string | null;
  outcome: string;
  notes: string | null;
  created_at: string;
  drop_reason: string | null;
  lead?: { full_name: string; phone: string } | null;
  performer?: { full_name: string } | null;
}

function CallOutcomesReport({ from, to, companyId }: { from: string; to: string; companyId: string | null }) {
  const [rows, setRows] = useState<CallOutcomeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOutcome, setFilterOutcome] = useState<string>("all");

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const fromIso = new Date(from).toISOString();
      const toIso = new Date(new Date(to).getTime() + 86400_000).toISOString();
      const { data } = await supabase.from("call_outcomes" as any)
        .select("id,lead_id,outcome,notes,created_at,drop_reason,performed_by")
        .eq("company_id", companyId)
        .gte("created_at", fromIso).lte("created_at", toIso)
        .order("created_at", { ascending: false }).limit(500);
      const base = (data as any[]) ?? [];
      const leadIds = [...new Set(base.map((r) => r.lead_id))];
      const perfIds = [...new Set(base.map((r) => r.performed_by).filter(Boolean))];
      const [{ data: leads }, { data: profs }] = await Promise.all([
        leadIds.length ? supabase.from("leads").select("id,full_name,phone").in("id", leadIds) : Promise.resolve({ data: [] as any[] }),
        perfIds.length ? supabase.from("profiles").select("id,full_name").in("id", perfIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const ml = new Map((leads ?? []).map((l: any) => [l.id, l]));
      const mp = new Map((profs ?? []).map((p: any) => [p.id, p]));
      if (cancelled) return;
      setRows(base.map((r) => ({ ...r, lead: ml.get(r.lead_id) ?? null, performer: mp.get(r.performed_by) ?? null })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [from, to, companyId]);

  const filtered = filterOutcome === "all" ? rows : rows.filter((r) => r.outcome === filterOutcome);
  const counts = {
    total: rows.length,
    interested: rows.filter((r) => r.outcome === "interested").length,
    meeting_scheduled: rows.filter((r) => r.outcome === "meeting_scheduled").length,
    callback_requested: rows.filter((r) => r.outcome === "callback_requested").length,
    not_interested: rows.filter((r) => r.outcome === "not_interested").length,
  };

  const exportCsv = () => {
    const headers = ["Lead", "Phone", "Outcome", "Notes", "Drop reason", "Staff", "Date"];
    const lines = [headers.join(",")];
    filtered.forEach((r) => {
      lines.push([
        r.lead?.full_name ?? "", r.lead?.phone ?? "", r.outcome,
        r.notes ?? "", r.drop_reason ?? "", r.performer?.full_name ?? "", r.created_at,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `call-outcomes-${from}-${to}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base">Call outcomes</CardTitle>
          <CardDescription>Calls logged in this date range</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div className="border rounded-md p-2"><div className="text-muted-foreground">Total</div><div className="text-lg font-semibold">{counts.total}</div></div>
          <div className="border rounded-md p-2"><div className="text-muted-foreground">Interested</div><div className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">{counts.interested}</div></div>
          <div className="border rounded-md p-2"><div className="text-muted-foreground">Meetings</div><div className="text-lg font-semibold text-blue-700 dark:text-blue-300">{counts.meeting_scheduled}</div></div>
          <div className="border rounded-md p-2"><div className="text-muted-foreground">Callbacks</div><div className="text-lg font-semibold text-amber-700 dark:text-amber-300">{counts.callback_requested}</div></div>
          <div className="border rounded-md p-2"><div className="text-muted-foreground">Not interested</div><div className="text-lg font-semibold text-rose-700 dark:text-rose-300">{counts.not_interested}</div></div>
        </div>
        <div className="flex gap-2 flex-wrap text-xs">
          {(["all","interested","meeting_scheduled","callback_requested","other","not_interested"]).map((k) => (
            <button key={k} onClick={() => setFilterOutcome(k)}
              className={`px-2 py-1 rounded border ${filterOutcome === k ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}>
              {k.replace("_", " ")}
            </button>
          ))}
        </div>
        {loading ? <div className="text-xs text-muted-foreground py-2">Loading…</div> : filtered.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">No call outcomes in this period.</div>
        ) : (
          <ul className="divide-y text-sm max-h-96 overflow-y-auto">
            {filtered.map((r) => (
              <li key={r.id} className="py-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.lead?.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.outcome.replace("_", " ")}{r.notes ? ` — ${r.notes}` : ""}{r.drop_reason ? ` · ${r.drop_reason}` : ""}</div>
                </div>
                <div className="text-[11px] text-muted-foreground shrink-0 text-right">
                  <div>{r.performer?.full_name ?? "—"}</div>
                  <div>{new Date(r.created_at).toLocaleString("en-IN")}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
