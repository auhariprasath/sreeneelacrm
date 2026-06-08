import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateIN } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useDashboardRealtime } from "@/hooks/use-dashboard-realtime";
import { useAuth } from "@/lib/auth";

interface Completed {
  id: string;
  lead_id: string;
  event_date: string;
  full_name: string;
  feedback_sent_at: string | null;
  feedback_rating: number | null;
}

export function PostEventPanel() {
  const { activeCompanyId } = useAuth();
  const [rows, setRows] = useState<Completed[]>([]);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
    let q = supabase
      .from("bookings")
      .select("id, lead_id, event_date, feedback_wa_sent_at, leads(full_name), feedback(rating)")
      .is("deleted_at", null).eq("status", "completed")
      .gte("event_date", since).order("event_date", { ascending: false }).limit(40);
    if (activeCompanyId) q = q.eq("company_id", activeCompanyId);
    const { data } = await q;
    setRows(((data ?? []) as any[]).map((b) => ({
      id: b.id, lead_id: b.lead_id, event_date: b.event_date,
      full_name: b.leads?.full_name ?? "—",
      feedback_sent_at: b.feedback_wa_sent_at,
      feedback_rating: b.feedback?.[0]?.rating ?? null,
    })));
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);
  useDashboardRealtime(["bookings", "feedback"], load);


  const received = rows.filter((r) => r.feedback_rating !== null);
  const pending = rows.filter((r) => r.feedback_rating === null);
  const buckets = [1, 2, 3, 4, 5].map((star) => ({
    star: `${star}★`,
    count: received.filter((r) => r.feedback_rating === star).length,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Post-event feedback</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Received</div>
            <div className="text-xl font-semibold mt-1">{received.length}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Pending</div>
            <div className="text-xl font-semibold mt-1">{pending.length}</div>
          </div>
        </div>

        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets}>
              <XAxis dataKey="star" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={10} width={28} allowDecimals={false} />
              <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
              <Bar
                dataKey="count"
                fill="hsl(var(--primary))"
                radius={[2, 2, 0, 0]}
                cursor="pointer"
                onClick={(d: any) => {
                  const star = parseInt(String(d?.star ?? "").replace("★", ""), 10);
                  if (Number.isFinite(star)) navigate({ to: "/feedback", search: { rating: star } as any });
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {pending.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">Awaiting feedback</div>
            <ul className="divide-y rounded-lg border">
              {pending.slice(0, 6).map((r) => (
                <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.full_name}</div>
                    <div className="text-[11px] text-muted-foreground">{formatDateIN(r.event_date)}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.feedback_sent_at ? (
                      <Badge variant="secondary" className="text-[10px]">Sent</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Not sent</Badge>
                    )}
                    <Link to="/leads/$leadId" params={{ leadId: r.lead_id }} className="text-xs text-primary underline">Open</Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
