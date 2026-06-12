import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import {
  Users, PhoneCall, CalendarCheck, CheckCircle2, TrendingUp, Award,
  BarChart3, Loader2, Trophy, Target,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Cell, PieChart, Pie,
} from "recharts";

export const Route = createFileRoute("/_app/analytics")({ component: AnalyticsPage });

interface StaffMetric {
  id: string;
  name: string;
  short: string;
  leadsAssigned: number;
  leadsConverted: number;
  followUpsDone: number;
  meetingsDone: number;
  tasksDone: number;
  conversionRate: number;
  score: number;
}

interface TrendPoint { month: string; leads: number; conversions: number }

const SCORE_WEIGHTS = { leadsConverted: 40, followUpsDone: 20, meetingsDone: 25, tasksDone: 15 };
const COLORS = ["#6366f1","#22c55e","#f59e0b","#ef4444","#0ea5e9","#a855f7","#ec4899","#14b8a6"];

function calcScore(m: StaffMetric, maxVals: Record<string, number>) {
  return Math.round(
    (maxVals.leadsConverted ? (m.leadsConverted / maxVals.leadsConverted) * SCORE_WEIGHTS.leadsConverted : 0) +
    (maxVals.followUpsDone  ? (m.followUpsDone  / maxVals.followUpsDone)  * SCORE_WEIGHTS.followUpsDone  : 0) +
    (maxVals.meetingsDone   ? (m.meetingsDone   / maxVals.meetingsDone)   * SCORE_WEIGHTS.meetingsDone   : 0) +
    (maxVals.tasksDone      ? (m.tasksDone      / maxVals.tasksDone)      * SCORE_WEIGHTS.tasksDone      : 0),
  );
}

function shortName(name: string) {
  const parts = name.trim().split(" ");
  return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function SummaryCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <Card className="p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs font-medium text-foreground">{label}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </Card>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-[11px] font-bold bg-yellow-400/20 text-yellow-700 dark:text-yellow-300 border border-yellow-400/40 rounded-full px-2 py-0.5 flex items-center gap-0.5"><Trophy className="h-3 w-3" />1st</span>;
  if (rank === 2) return <span className="text-[11px] font-bold bg-slate-300/20 text-slate-600 dark:text-slate-300 border border-slate-400/40 rounded-full px-2 py-0.5">2nd</span>;
  if (rank === 3) return <span className="text-[11px] font-bold bg-orange-400/20 text-orange-700 dark:text-orange-300 border border-orange-400/40 rounded-full px-2 py-0.5">3rd</span>;
  return <span className="text-[11px] text-muted-foreground rounded-full px-2 py-0.5 bg-muted">#{rank}</span>;
}

export default function AnalyticsPage() {
  const { role, profile, activeCompanyId, companies } = useAuth();
  const companyId = role === "super_admin" ? activeCompanyId : (profile?.company_id ?? companies[0]?.id ?? null);

  const [metrics, setMetrics] = useState<StaffMetric[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [period, setPeriod] = useState<"30" | "90" | "180" | "365">("90");
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ leads: 0, conversions: 0, followUps: 0, meetings: 0, tasks: 0 });

  // For super_admin with no company selected, load across all their companies
  const allCompanyIds = role === "super_admin" && !companyId
    ? companies.map((c) => c.id)
    : null;

  useEffect(() => {
    if (!companyId && !allCompanyIds?.length) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, period, companies.length]);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - Number(period) * 86400_000).toISOString();

    const companyIds = allCompanyIds;

    const applyCompanyFilter = (q: any) =>
      companyIds ? q.in("company_id", companyIds) : q.eq("company_id", companyId!);

    const [staffRes, leadsRes, fuRes, vmRes, tasksRes] = await Promise.all([
      companyIds
        ? supabase.from("profiles").select("id, full_name").in("company_id", companyIds)
        : supabase.from("profiles").select("id, full_name").eq("company_id", companyId!),
      applyCompanyFilter(supabase.from("leads").select("id, assigned_to, status, created_at")).gte("created_at", since),
      supabase.from("follow_ups").select("id, created_by, is_sent, created_at").eq("is_sent", true).gte("created_at", since),
      applyCompanyFilter(supabase.from("venue_meetings").select("id, created_by, status, scheduled_date").eq("status", "completed")).gte("scheduled_date", since.slice(0, 10)),
      applyCompanyFilter(supabase.from("tasks").select("id, assigned_to, status, updated_at").eq("status", "done")).gte("updated_at", since),
    ]);

    const staff = (staffRes.data as any[]) ?? [];
    const leads = (leadsRes.data as any[]) ?? [];
    const fus   = (fuRes.data as any[]) ?? [];
    const vms   = (vmRes.data as any[]) ?? [];
    const tasks = (tasksRes.data as any[]) ?? [];

    const rawMetrics = staff.map((s) => {
      const myLeads    = leads.filter((l) => l.assigned_to === s.id);
      const converted  = myLeads.filter((l) => ["locked","positive","closed"].includes(l.status)).length;
      const fuDone     = fus.filter((f) => f.created_by === s.id).length;
      const vmDone     = vms.filter((v) => v.created_by === s.id).length;
      const tasksDone  = tasks.filter((t) => t.assigned_to === s.id).length;
      return {
        id: s.id,
        name: s.full_name ?? "Unknown",
        short: shortName(s.full_name ?? "Unknown"),
        leadsAssigned: myLeads.length,
        leadsConverted: converted,
        followUpsDone: fuDone,
        meetingsDone: vmDone,
        tasksDone,
        conversionRate: myLeads.length > 0 ? Math.round((converted / myLeads.length) * 100) : 0,
        score: 0,
      };
    });

    const maxVals = {
      leadsConverted: Math.max(...rawMetrics.map((m) => m.leadsConverted), 1),
      followUpsDone:  Math.max(...rawMetrics.map((m) => m.followUpsDone), 1),
      meetingsDone:   Math.max(...rawMetrics.map((m) => m.meetingsDone), 1),
      tasksDone:      Math.max(...rawMetrics.map((m) => m.tasksDone), 1),
    };

    const withScore = rawMetrics
      .map((m) => ({ ...m, score: calcScore(m, maxVals) }))
      .sort((a, b) => b.score - a.score);

    setMetrics(withScore);
    setTotals({
      leads: leads.length,
      conversions: leads.filter((l) => ["locked","positive","closed"].includes(l.status)).length,
      followUps: fus.length,
      meetings: vms.length,
      tasks: tasks.length,
    });

    // Trend by month
    const monthMap: Record<string, { leads: number; conversions: number }> = {};
    for (const l of leads) {
      const d = new Date(l.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      if (!monthMap[key]) monthMap[key] = { leads: 0, conversions: 0 };
      monthMap[key].leads++;
      if (["locked","positive","closed"].includes(l.status)) monthMap[key].conversions++;
    }
    setTrend(
      Object.entries(monthMap)
        .sort(([a],[b]) => a.localeCompare(b))
        .map(([key, v]) => ({ month: `${MONTH_NAMES[Number(key.slice(5))-1]}`, ...v })),
    );
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading analytics…
      </div>
    );
  }

  // Data shapes for charts
  const staffBarData = metrics.map((m) => ({
    name: m.short,
    "Leads": m.leadsAssigned,
    "Converted": m.leadsConverted,
    "Follow-ups": m.followUpsDone,
    "Meetings": m.meetingsDone,
    "Tasks": m.tasksDone,
  }));

  const radarData = metrics.slice(0, 5).map((m) => ({
    staff: m.short,
    Conversion: m.conversionRate,
    "Follow-ups": Math.min(m.followUpsDone, 100),
    Meetings: Math.min(m.meetingsDone * 5, 100),
    Tasks: Math.min(m.tasksDone * 2, 100),
    Score: m.score,
  }));

  const pieData = metrics.map((m, i) => ({
    name: m.short,
    value: m.leadsAssigned,
    color: COLORS[i % COLORS.length],
  }));

  const scoreBarData = metrics.map((m, i) => ({
    name: m.short,
    Score: m.score,
    color: COLORS[i % COLORS.length],
  }));

  const tooltipStyle = {
    contentStyle: { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 },
    labelStyle: { color: "hsl(var(--foreground))", fontWeight: 600 },
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Staff performance & activity overview</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(["30","90","180","365"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${period === p ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {p === "30" ? "30d" : p === "90" ? "3M" : p === "180" ? "6M" : "1Y"}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard icon={<Users className="h-4 w-4 text-indigo-600" />} label="Total Leads" value={totals.leads} sub={`last ${period} days`} color="bg-indigo-100 dark:bg-indigo-900/40" />
        <SummaryCard icon={<Target className="h-4 w-4 text-green-600" />} label="Converted" value={totals.conversions} sub={`${totals.leads ? Math.round((totals.conversions/totals.leads)*100) : 0}% rate`} color="bg-green-100 dark:bg-green-900/40" />
        <SummaryCard icon={<PhoneCall className="h-4 w-4 text-sky-600" />} label="Follow-ups" value={totals.followUps} color="bg-sky-100 dark:bg-sky-900/40" />
        <SummaryCard icon={<CalendarCheck className="h-4 w-4 text-amber-600" />} label="Meetings" value={totals.meetings} color="bg-amber-100 dark:bg-amber-900/40" />
        <SummaryCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="Tasks Done" value={totals.tasks} color="bg-emerald-100 dark:bg-emerald-900/40" />
      </div>

      {/* Trend line chart */}
      {trend.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Monthly Lead Trend
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="leads" name="Leads" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="conversions" name="Converted" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Staff activity grouped bar chart */}
      {staffBarData.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Staff Activity Breakdown
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={staffBarData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Leads"      fill="#6366f1" radius={[3,3,0,0]} />
              <Bar dataKey="Converted"  fill="#22c55e" radius={[3,3,0,0]} />
              <Bar dataKey="Follow-ups" fill="#0ea5e9" radius={[3,3,0,0]} />
              <Bar dataKey="Meetings"   fill="#f59e0b" radius={[3,3,0,0]} />
              <Bar dataKey="Tasks"      fill="#a855f7" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Score bar + Pie side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Performance score bar */}
        <Card className="p-4 space-y-3">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Award className="h-4 w-4 text-yellow-500" /> Performance Score
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scoreBarData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" domain={[0,100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={70} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="Score" radius={[0,4,4,0]}>
                {scoreBarData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Leads distribution pie */}
        <Card className="p-4 space-y-3">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Leads Distribution
          </div>
          {totals.leads === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No leads in this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Radar chart — multi-dimension comparison */}
      {radarData.length >= 2 && (
        <Card className="p-4 space-y-3">
          <div className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Multi-dimension Performance Radar
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={[
              { metric: "Conversion %", ...Object.fromEntries(metrics.slice(0,5).map((m) => [m.short, m.conversionRate])) },
              { metric: "Follow-ups",   ...Object.fromEntries(metrics.slice(0,5).map((m) => [m.short, m.followUpsDone])) },
              { metric: "Meetings",     ...Object.fromEntries(metrics.slice(0,5).map((m) => [m.short, m.meetingsDone])) },
              { metric: "Tasks",        ...Object.fromEntries(metrics.slice(0,5).map((m) => [m.short, m.tasksDone])) },
              { metric: "Score",        ...Object.fromEntries(metrics.slice(0,5).map((m) => [m.short, m.score])) },
            ]}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis tick={{ fontSize: 10 }} />
              {metrics.slice(0, 5).map((m, i) => (
                <Radar key={m.id} name={m.short} dataKey={m.short} stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.15} />
              ))}
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip {...tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Leaderboard */}
      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Award className="h-4 w-4 text-yellow-500" /> Staff Leaderboard
        </div>
        {metrics.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">No staff data for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left py-2 pr-3">Rank</th>
                  <th className="text-left py-2 pr-3">Staff</th>
                  <th className="text-center py-2 px-2">Leads</th>
                  <th className="text-center py-2 px-2">Converted</th>
                  <th className="text-center py-2 px-2">Rate</th>
                  <th className="text-center py-2 px-2">Follow-ups</th>
                  <th className="text-center py-2 px-2">Meetings</th>
                  <th className="text-center py-2 px-2">Tasks</th>
                  <th className="text-center py-2 pl-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m, idx) => (
                  <tr key={m.id} className={`border-b last:border-0 ${idx === 0 ? "bg-yellow-400/5" : ""}`}>
                    <td className="py-2 pr-3"><RankBadge rank={idx + 1} /></td>
                    <td className="py-2 pr-3 font-medium">{m.name}</td>
                    <td className="text-center py-2 px-2">{m.leadsAssigned}</td>
                    <td className="text-center py-2 px-2 text-green-600 font-medium">{m.leadsConverted}</td>
                    <td className="text-center py-2 px-2">
                      <span className={`font-medium ${m.conversionRate >= 50 ? "text-green-600" : m.conversionRate >= 25 ? "text-amber-600" : "text-red-500"}`}>
                        {m.conversionRate}%
                      </span>
                    </td>
                    <td className="text-center py-2 px-2">{m.followUpsDone}</td>
                    <td className="text-center py-2 px-2">{m.meetingsDone}</td>
                    <td className="text-center py-2 px-2">{m.tasksDone}</td>
                    <td className="text-center py-2 pl-2">
                      <span className="font-bold" style={{ color: COLORS[idx % COLORS.length] }}>{m.score}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
