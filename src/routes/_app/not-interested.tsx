import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, AlertTriangle, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

export const Route = createFileRoute("/_app/not-interested")({
  component: NotInterestedPage,
});

interface Row {
  lead_id: string;
  full_name: string;
  phone: string;
  company_id: string;
  company_name: string;
  drop_reason: string | null;
  closed_at: string;
  closed_by: string | null;
  staff_name: string | null;
}

function NotInterestedPage() {
  const { role, activeCompanyId } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [reFilter, setReFilter] = useState<string>("all");

  useEffect(() => {
    if (role && role !== "super_admin") navigate({ to: "/dashboard" });
  }, [role, navigate]);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 365 * 86400_000).toISOString();
    let q = supabase
      .from("win_loss_log")
      .select("lead_id, drop_reason, closed_at, closed_by, company_id, outcome")
      .eq("outcome", "lost" as any)
      .gte("closed_at", since)
      .order("closed_at", { ascending: false });
    if (activeCompanyId) q = q.eq("company_id", activeCompanyId);
    const { data } = await q;

    const leadIds = Array.from(new Set((data ?? []).map((r) => r.lead_id)));
    const companyIds = Array.from(new Set((data ?? []).map((r) => r.company_id)));
    const staffIds = Array.from(new Set((data ?? []).map((r) => r.closed_by).filter(Boolean) as string[]));

    const [{ data: leads }, { data: comps }, { data: staff }] = await Promise.all([
      leadIds.length
        ? supabase.from("leads").select("id, full_name, phone, status").in("id", leadIds)
        : Promise.resolve({ data: [] as any[] }),
      companyIds.length
        ? supabase.from("companies").select("id, name").in("id", companyIds)
        : Promise.resolve({ data: [] as any[] }),
      staffIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", staffIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const leadMap = new Map((leads ?? []).map((l: any) => [l.id, l]));
    const compMap = new Map((comps ?? []).map((c: any) => [c.id, c.name]));
    const staffMap = new Map((staff ?? []).map((s: any) => [s.id, s.full_name]));

    const merged: Row[] = (data ?? [])
      .filter((r) => {
        const l = leadMap.get(r.lead_id);
        return l && (l.status === "negative" || l.status === "unresponsive" || l.status === "closed");
      })
      .map((r) => {
        const l = leadMap.get(r.lead_id);
        return {
          lead_id: r.lead_id,
          full_name: l?.full_name ?? "—",
          phone: l?.phone ?? "",
          company_id: r.company_id,
          company_name: compMap.get(r.company_id) ?? "—",
          drop_reason: r.drop_reason,
          closed_at: r.closed_at,
          closed_by: r.closed_by,
          staff_name: r.closed_by ? staffMap.get(r.closed_by) ?? null : null,
        };
      });
    setRows(merged);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeCompanyId]);

  // Summary metrics
  const monthStart = useMemo(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.getTime(); }, []);
  const thirtyAgo = Date.now() - 30 * 86400_000;

  const monthRows = rows.filter((r) => new Date(r.closed_at).getTime() >= monthStart);
  const last30 = rows.filter((r) => new Date(r.closed_at).getTime() >= thirtyAgo);

  const reasonCount = (list: Row[]) => {
    const map = new Map<string, number>();
    list.forEach((r) => {
      const k = (r.drop_reason ?? "Unspecified").trim() || "Unspecified";
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  };
  const topReason30 = reasonCount(last30)[0];
  const topReasonMonth = reasonCount(monthRows)[0];

  const byCompany = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    monthRows.forEach((r) => {
      const e = map.get(r.company_id) ?? { name: r.company_name, count: 0 };
      e.count += 1; map.set(r.company_id, e);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [monthRows]);

  const byStaff = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    monthRows.forEach((r) => {
      const key = r.closed_by ?? "unassigned";
      const e = map.get(key) ?? { name: r.staff_name ?? "Unassigned", count: 0 };
      e.count += 1; map.set(key, e);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [monthRows]);

  // Trend over 6 months — top 5 reasons, grouped per-month
  const trend = useMemo(() => {
    const months: Array<{ label: string; start: number; end: number }> = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      months.push({ label: d.toLocaleString("default", { month: "short" }), start: d.getTime(), end: end.getTime() });
    }
    const reasons = reasonCount(rows.filter((r) => new Date(r.closed_at).getTime() >= months[0].start)).slice(0, 5).map(([k]) => k);
    return months.map((m) => {
      const inRange = rows.filter((r) => {
        const t = new Date(r.closed_at).getTime();
        return t >= m.start && t < m.end;
      });
      const row: any = { month: m.label, total: inRange.length };
      reasons.forEach((r) => {
        row[r] = inRange.filter((x) => ((x.drop_reason ?? "Unspecified").trim() || "Unspecified") === r).length;
      });
      return row;
    });
  }, [rows]);

  // Filter applied to table
  const reasonOptions = useMemo(() => Array.from(new Set(rows.map((r) => (r.drop_reason ?? "Unspecified")))), [rows]);
  const filtered = rows.filter((r) => {
    if (reFilter !== "all" && (r.drop_reason ?? "Unspecified") !== reFilter) return false;
    if (search && !`${r.full_name} ${r.phone} ${r.company_name}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const reengage = async (r: Row) => {
    const callbackAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    const { error: lErr } = await supabase
      .from("leads")
      .update({ status: "in_progress" })
      .eq("id", r.lead_id);
    if (lErr) { toast.error(lErr.message); return; }
    await supabase.from("follow_ups").insert({
      lead_id: r.lead_id,
      scheduled_at: callbackAt,
      type: "custom",
      note: "Re-engaged from Not interested folder",
    });
    await supabase.from("activity_logs").insert({
      lead_id: r.lead_id, action: "Re-engaged by SA.", action_type: "system",
    });
    toast.success(`Re-engaged ${r.full_name}`);
    load();
  };

  if (role && role !== "super_admin") {
    return <div className="p-6 text-sm text-muted-foreground">Super Admin access required.</div>;
  }
  if (loading) {
    return <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Not interested</h1>
          <p className="text-sm text-muted-foreground">Lost enquiries across all companies</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Not interested this month</div>
          <div className="text-2xl font-bold mt-1">{monthRows.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Top reason (month)</div>
          <div className="text-lg font-bold mt-1 truncate">{topReasonMonth?.[0] ?? "—"}</div>
          <div className="text-xs text-muted-foreground">{topReasonMonth?.[1] ?? 0} leads</div>
        </Card>
        <Card className="p-4 md:col-span-2">
          <div className="text-xs text-muted-foreground mb-2">By company (this month)</div>
          {byCompany.length === 0 ? (
            <div className="text-sm text-muted-foreground">No data</div>
          ) : (
            <div className="space-y-1">
              {byCompany.slice(0, 5).map((c) => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span className="truncate">{c.name}</span>
                  <span className="font-semibold">{c.count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <div className="text-xs text-muted-foreground mb-2">By staff (this month)</div>
        {byStaff.length === 0 ? (
          <div className="text-sm text-muted-foreground">No data</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {byStaff.slice(0, 8).map((s) => (
              <div key={s.name} className="flex items-center justify-between text-sm border rounded-md p-2">
                <span className="truncate">{s.name}</span>
                <span className="font-semibold">{s.count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Trend chart */}
      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Reasons over last 6 months</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend}>
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" radius={[6, 6, 0, 0]} cursor="pointer"
                onClick={(_data, index) => {
                  // Filter table by clicked month not implemented in detail; reveal all reasons that month
                  setReFilter("all");
                  setSearch(trend[index]?.month ? "" : "");
                }}
              >
                {trend.map((_, i) => <Cell key={i} fill="hsl(270 70% 55%)" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* SA insight */}
      <Card className="p-4 border-l-4 border-purple-600">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-purple-600 mt-0.5" />
          <div>
            <div className="font-semibold text-sm">
              In the last 30 days, {last30.length} enquiries said not interested.
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Most common reason: <span className="font-medium text-foreground">{topReason30?.[0] ?? "—"}</span>
              {topReason30 ? ` (${topReason30[1]})` : ""}
            </div>
            {topReason30 && (
              <div className="text-xs text-muted-foreground mt-2">
                Suggested action: {suggestAction(topReason30[0])}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-3">
        <div className="flex flex-col md:flex-row gap-2 mb-3">
          <Input
            placeholder="Search name, phone, company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <select
            className="border rounded-md h-10 px-2 text-sm bg-background"
            value={reFilter}
            onChange={(e) => setReFilter(e.target.value)}
          >
            <option value="all">All reasons</option>
            {reasonOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Lead</th>
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3">Company</th>
                <th className="py-2 pr-3">Reason</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Staff</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No records.</td></tr>
              ) : filtered.map((r) => (
                <tr key={`${r.lead_id}-${r.closed_at}`} className="border-b hover:bg-muted/40">
                  <td className="py-2 pr-3">
                    <Link to="/leads/$leadId" params={{ leadId: r.lead_id }} className="text-purple-700 font-medium hover:underline">
                      {r.full_name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.phone}</td>
                  <td className="py-2 pr-3">{r.company_name}</td>
                  <td className="py-2 pr-3 max-w-xs truncate">{r.drop_reason ?? "—"}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{new Date(r.closed_at).toLocaleDateString()}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.staff_name ?? "—"}</td>
                  <td className="py-2 pr-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => reengage(r)}>
                      <RotateCw className="h-3.5 w-3.5 mr-1" /> Re-engage
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function suggestAction(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes("price") || r.includes("budget") || r.includes("expensive")) return "Review your pricing tier or introduce a starter package.";
  if (r.includes("date") || r.includes("availab")) return "Audit calendar coverage; consider opening additional sessions.";
  if (r.includes("respon") || r.includes("reply") || r.includes("slow")) return "Tighten first-response SLA and enable auto-acknowledgement.";
  if (r.includes("compet")) return "Run a win/loss interview and document differentiators for staff.";
  return "Review recent lead conversations and run a coaching session with staff.";
}
