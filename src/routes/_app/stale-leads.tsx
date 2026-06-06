import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Phone, AlertTriangle } from "lucide-react";
import { formatPhoneIN } from "@/lib/format";
import { LEAD_STATUS_LABEL } from "@/lib/labels";

export const Route = createFileRoute("/_app/stale-leads")({ component: StaleLeadsPage });

type Row = {
  id: string; full_name: string; phone: string; status: string;
  updated_at: string; company_id: string; company_name: string;
  threshold: number; days_overdue: number;
};

const STATUS_TO_KEY: Record<string, string> = {
  new: "new", in_progress: "in_progress",
  neutral: "no_reply", positive: "quote_accepted", negative: "no_reply",
};

function StaleLeadsPage() {
  const { role } = useAuth();
  if (role !== "super_admin") return <Navigate to="/dashboard" />;
  const [rows, setRows] = useState<Row[]>([]);
  const [companyFilter, setCompanyFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data: cos } = await supabase.from("companies")
        .select("id, name, stale_alerts_enabled, stale_thresholds").is("deleted_at", null);
      const result: Row[] = [];
      for (const co of cos ?? []) {
        if (!(co as any).stale_alerts_enabled) continue;
        const t = (co as any).stale_thresholds ?? {};
        const thr: Record<string, number> = {
          new: Number(t.new ?? 2), in_progress: Number(t.in_progress ?? 3),
          quote_sent: Number(t.quote_sent ?? 7), quote_accepted: Number(t.quote_accepted ?? 3),
          no_reply: Number(t.no_reply ?? 5),
        };
        const { data: leads } = await supabase.from("leads")
          .select("id, full_name, phone, status, updated_at")
          .eq("company_id", co.id).is("deleted_at", null)
          .in("status", ["new", "in_progress", "neutral", "positive", "negative"]);
        const now = Date.now();
        (leads ?? []).forEach((ld: any) => {
          const key = STATUS_TO_KEY[ld.status] ?? "no_reply";
          const limit = thr[key] ?? 5;
          const days = Math.floor((now - new Date(ld.updated_at).getTime()) / 86400_000);
          if (days >= limit) {
            result.push({
              id: ld.id, full_name: ld.full_name, phone: ld.phone, status: ld.status,
              updated_at: ld.updated_at, company_id: co.id, company_name: co.name,
              threshold: limit, days_overdue: days - limit,
            });
          }
        });
      }
      result.sort((a, b) => b.days_overdue - a.days_overdue);
      setRows(result);
    })();
  }, []);

  const companies = useMemo(() => {
    const set = new Map<string, string>();
    rows.forEach((r) => set.set(r.company_id, r.company_name));
    return Array.from(set, ([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = companyFilter === "all" ? rows : rows.filter((r) => r.company_id === companyFilter);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Stale leads
        </h1>
        <p className="text-sm text-muted-foreground">Leads sitting in the same stage past the configured threshold.</p>
      </div>
      <div className="flex items-center gap-2">
        <select className="h-9 rounded-md border bg-background px-2 text-sm"
          value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
          <option value="all">All companies</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length} stale</span>
      </div>

      <Card className="divide-y">
        {filtered.length === 0 && <div className="p-6 text-sm text-muted-foreground">No stale leads. </div>}
        {filtered.map((r) => (
          <div key={r.id} className="p-3 flex items-center justify-between gap-2">
            <Link to="/leads/$leadId" params={{ leadId: r.id }} className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate text-primary hover:underline">{r.full_name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {r.company_name} · {(LEAD_STATUS_LABEL as Record<string, string>)[r.status] ?? r.status} ·{" "}
                <span className="text-amber-600 font-medium">+{r.days_overdue}d over {r.threshold}d limit</span>
              </div>
            </Link>
            <a href={`tel:+91${r.phone.replace(/\D/g, "")}`}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-md bg-emerald-600 text-white text-xs">
              <Phone className="h-3.5 w-3.5" /> {formatPhoneIN(r.phone, false)}
            </a>
          </div>
        ))}
      </Card>
    </div>
  );
}
