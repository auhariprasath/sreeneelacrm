import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Phone, ListTodo, FileText, AlertCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateIN, formatTimeOfDay, formatINR } from "@/lib/format";
import { useDashboardRealtime } from "@/hooks/use-dashboard-realtime";

interface Data {
  callBacks: Array<{ id: string; lead_id: string; full_name: string; scheduled_at: string }>;
  tasks: Array<{ id: string; booking_id: string; lead_id: string | null; title: string; due_at: string | null }>;
  quotations: Array<{ id: string; lead_id: string; quotation_number: string; total: number }>;
  overdue: Array<{ id: string; booking_id: string; lead_id: string | null; title: string; due_at: string }>;
  staleCount: number;
}

async function load(): Promise<Data> {
  const nowIso = new Date().toISOString();
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const eotIso = endOfToday.toISOString();
  const in3d = new Date(Date.now() + 3 * 86400_000).toISOString();

  const [followUps, tasksRes, quots, overdueRes, companiesRes] = await Promise.all([
    supabase.from("follow_ups")
      .select("id, lead_id, scheduled_at, leads!inner(full_name)")
      .eq("is_sent", false).eq("is_cancelled", false)
      .lte("scheduled_at", eotIso).order("scheduled_at", { ascending: true }).limit(15),
    supabase.from("tasks")
      .select("id, booking_id, title, due_at, bookings(lead_id)")
      .is("deleted_at", null).neq("status", "done")
      .gte("due_at", nowIso).lte("due_at", in3d)
      .order("due_at", { ascending: true }).limit(15),
    supabase.from("quotations")
      .select("id, lead_id, quotation_number, total")
      .is("deleted_at", null).eq("status", "sent")
      .order("created_at", { ascending: false }).limit(10),
    supabase.from("tasks")
      .select("id, booking_id, title, due_at, bookings(lead_id)")
      .is("deleted_at", null).neq("status", "done")
      .lt("due_at", nowIso).order("due_at", { ascending: true }).limit(15),
    supabase.from("companies").select("id, stale_alerts_enabled, stale_thresholds").is("deleted_at", null),
  ]);

  // Compute stale leads across companies (lightweight: counts only)
  const statusToKey: Record<string, string> = {
    new: "new", in_progress: "in_progress",
    neutral: "no_reply", positive: "quote_accepted", negative: "no_reply",
  };
  let staleCount = 0;
  const nowMs = Date.now();
  for (const co of (companiesRes.data ?? []) as any[]) {
    if (!co.stale_alerts_enabled) continue;
    const t = co.stale_thresholds ?? {};
    const thr: Record<string, number> = {
      new: Number(t.new ?? 2), in_progress: Number(t.in_progress ?? 3),
      quote_sent: Number(t.quote_sent ?? 7), quote_accepted: Number(t.quote_accepted ?? 3),
      no_reply: Number(t.no_reply ?? 5),
    };
    const { data: leads } = await supabase.from("leads")
      .select("status, updated_at")
      .eq("company_id", co.id).is("deleted_at", null)
      .in("status", ["new", "in_progress", "neutral", "positive", "negative"]);
    (leads ?? []).forEach((ld: any) => {
      const key = statusToKey[ld.status] ?? "no_reply";
      const limit = thr[key] ?? 5;
      const days = Math.floor((nowMs - new Date(ld.updated_at).getTime()) / 86400_000);
      if (days >= limit) staleCount++;
    });
  }

  return {
    callBacks: ((followUps.data ?? []) as any[]).map((f) => ({
      id: f.id, lead_id: f.lead_id, full_name: f.leads?.full_name ?? "—", scheduled_at: f.scheduled_at,
    })),
    tasks: ((tasksRes.data ?? []) as any[]).map((t) => ({
      id: t.id, booking_id: t.booking_id, lead_id: t.bookings?.lead_id ?? null, title: t.title, due_at: t.due_at,
    })),
    quotations: (quots.data ?? []) as any,
    overdue: ((overdueRes.data ?? []) as any[]).map((t) => ({
      id: t.id, booking_id: t.booking_id, lead_id: t.bookings?.lead_id ?? null, title: t.title, due_at: t.due_at,
    })),
    staleCount,
  };
}

function Section({ icon: Icon, title, count, children }: { icon: any; title: string; count: number; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <span className="text-xs text-muted-foreground">{count}</span>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

export function RightSidebar() {
  const [d, setD] = useState<Data | null>(null);
  const refresh = () => load().then(setD);
  useEffect(() => { refresh(); }, []);
  useDashboardRealtime(["follow_ups", "tasks", "quotations"], refresh);

  const data = d ?? { callBacks: [], tasks: [], quotations: [], overdue: [] };

  return (
    <div className="space-y-4">
      <Section icon={Phone} title="Call backs today" count={data.callBacks.length}>
        {data.callBacks.length === 0 ? (
          <div className="text-xs text-muted-foreground p-3">None scheduled</div>
        ) : (
          <ul className="divide-y">
            {data.callBacks.map((c) => (
              <li key={c.id} className="px-3 py-2 text-sm flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.full_name}</div>
                  <div className="text-[11px] text-muted-foreground">{formatTimeOfDay(new Date(c.scheduled_at).toTimeString().slice(0, 8))}</div>
                </div>
                <Link to="/leads/$leadId" params={{ leadId: c.lead_id }} className="text-xs text-primary underline shrink-0">Open</Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={AlertCircle} title="Overdue tasks" count={data.overdue.length}>
        {data.overdue.length === 0 ? (
          <div className="text-xs text-muted-foreground p-3">None</div>
        ) : (
          <ul className="divide-y">
            {data.overdue.map((t) => (
              <li key={t.id} className="px-3 py-2 text-sm flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.title}</div>
                  <div className="text-[11px] text-destructive">Due {formatDateIN(t.due_at)}</div>
                </div>
                {t.lead_id && (
                  <Link to="/leads/$leadId" params={{ leadId: t.lead_id }} className="text-xs text-primary underline shrink-0">Open</Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={ListTodo} title="Upcoming tasks (3d)" count={data.tasks.length}>
        {data.tasks.length === 0 ? (
          <div className="text-xs text-muted-foreground p-3">None</div>
        ) : (
          <ul className="divide-y">
            {data.tasks.map((t) => (
              <li key={t.id} className="px-3 py-2 text-sm flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.title}</div>
                  <div className="text-[11px] text-muted-foreground">{t.due_at ? formatDateIN(t.due_at) : ""}</div>
                </div>
                {t.lead_id && (
                  <Link to="/leads/$leadId" params={{ leadId: t.lead_id }} className="text-xs text-primary underline shrink-0">Open</Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={FileText} title="Pending quotations" count={data.quotations.length}>
        {data.quotations.length === 0 ? (
          <div className="text-xs text-muted-foreground p-3">None</div>
        ) : (
          <ul className="divide-y">
            {data.quotations.map((q) => (
              <li key={q.id} className="px-3 py-2 text-sm flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium truncate">{q.quotation_number}</div>
                  <div className="text-[11px] text-muted-foreground">{formatINR(Number(q.total))}</div>
                </div>
                <Link to="/leads/$leadId" params={{ leadId: q.lead_id }} className="text-xs text-primary underline shrink-0">Open</Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
