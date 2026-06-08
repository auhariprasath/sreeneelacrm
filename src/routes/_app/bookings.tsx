import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDashboardRealtime } from "@/hooks/use-dashboard-realtime";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, CheckCircle2, AlertTriangle, Calendar as CalIcon } from "lucide-react";
import { SkeletonList } from "@/components/skeleton-list";
import { EmptyState } from "@/components/empty-state";
import { formatINR, formatDateIN, formatTimeOfDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Status = Database["public"]["Enums"]["booking_status"];

const bookingsSearchSchema = z.object({
  status: fallback(z.enum(["all", "confirmed", "cheque_pending", "rescheduled", "completed", "cancelled", "disputed"]), "all").default("all"),
  month: fallback(z.string().regex(/^\d{4}-\d{2}$/).optional(), undefined),
  company: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/bookings")({
  component: BookingsIndex,
  validateSearch: zodValidator(bookingsSearchSchema),
});

const TABS: { key: "all" | Status; label: string }[] = [
  { key: "all", label: "All" },
  { key: "confirmed", label: "Confirmed" },
  { key: "cheque_pending", label: "Cheque pending" },
  { key: "rescheduled", label: "Rescheduled" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "disputed", label: "Disputed" },
];

function statusStyle(s: Status) {
  switch (s) {
    case "confirmed": return "bg-success/15 text-success dark:text-success";
    case "cheque_pending": return "bg-warning/15 text-warning dark:text-warning";
    case "cancelled":
    case "disputed": return "bg-destructive/15 text-destructive dark:text-destructive";
    case "rescheduled": return "bg-info/15 text-info dark:text-sky-300";
    default: return "bg-muted text-muted-foreground";
  }
}

function BookingsIndex() {
  const { profile, role, activeCompanyId } = useAuth();
  const initialSearch = Route.useSearch();
  const [items, setItems] = useState<(Booking & { lead?: { full_name: string; phone: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"all" | Status>(initialSearch.status as any);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<"upcoming" | "month" | "past" | "all">(initialSearch.month ? "all" : "upcoming");
  const monthFilter = initialSearch.month;
  const companyOverride = initialSearch.company;

  // Super-admin: activeCompanyId from the top-bar switcher always wins so the
  // page re-fetches the moment the switcher changes, regardless of URL params.
  const companyFilter = useMemo(() => {
    if (role === "super_admin") return activeCompanyId;
    return profile?.company_id ?? null;
  }, [role, activeCompanyId, profile]);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("bookings")
      .select("*, lead:leads(full_name, phone)")
      .is("deleted_at", null)
      .order("event_date", { ascending: range === "past" ? false : true })
      .limit(200);
    if (companyFilter) q = q.eq("company_id", companyFilter);
    if (status !== "all") q = q.eq("status", status);
    const today = new Date().toISOString().slice(0, 10);
    if (monthFilter) {
      const [y, m] = monthFilter.split("-").map(Number);
      const start = `${monthFilter}-01`;
      const endDate = new Date(y, m, 0).toISOString().slice(0, 10);
      q = q.gte("event_date", start).lte("event_date", endDate);
    } else if (range === "upcoming") q = q.gte("event_date", today);
    else if (range === "past") q = q.lt("event_date", today);
    else if (range === "month") {
      const d = new Date(); d.setMonth(d.getMonth() + 1);
      q = q.gte("event_date", today).lte("event_date", d.toISOString().slice(0, 10));
    }
    const { data } = await q;
    setItems((data as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyFilter, status, range, monthFilter]);
  useDashboardRealtime(["bookings", "payments"], load);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter((b) =>
      b.lead?.full_name?.toLowerCase().includes(s) ||
      b.lead?.phone?.includes(s) ||
      b.venue?.toLowerCase().includes(s)
    );
  }, [items, search]);

  return (
    <div className="p-3 md:p-6 max-w-5xl mx-auto space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-semibold">Bookings</h1>
        <div className="text-xs text-muted-foreground">{filtered.length} result{filtered.length === 1 ? "" : "s"}</div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, phone, venue…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 min-h-11" />
      </div>

      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {(["upcoming", "month", "past", "all"] as const).map((r) => (
          <button key={r} onClick={() => setRange(r)}
            className={cn("text-xs rounded-full px-3 py-1.5 border whitespace-nowrap min-h-9",
              range === r ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent")}>
            {r === "upcoming" ? "Upcoming" : r === "month" ? "Next 30 days" : r === "past" ? "Past" : "All dates"}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setStatus(t.key)}
            className={cn("text-xs rounded-full px-3 py-1.5 border whitespace-nowrap min-h-9",
              status === t.key ? "bg-foreground text-background border-foreground" : "bg-background hover:bg-accent")}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <SkeletonList rows={6} /> : filtered.length === 0 ? (
        <EmptyState icon={<CalIcon className="h-8 w-8" />} title="No bookings" description="No bookings match the current filters." />
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => (
            <Link key={b.id} to="/leads/$leadId" params={{ leadId: b.lead_id }}
              className="block bg-card border rounded-lg p-3 hover:bg-accent/40 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{b.lead?.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <CalIcon className="h-3 w-3" />
                    {formatDateIN(b.event_date)}
                    {b.start_time && <span>· {formatTimeOfDay(b.start_time)}</span>}
                  </div>
                  {b.venue && <div className="text-[11px] text-muted-foreground truncate mt-0.5">{b.venue}</div>}
                </div>
                <span className={cn("text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 shrink-0", statusStyle(b.status))}>
                  {b.status === "confirmed" ? <CheckCircle2 className="h-3 w-3 inline -mt-0.5 mr-0.5" /> : null}
                  {b.status === "cheque_pending" || b.status === "disputed" ? <AlertTriangle className="h-3 w-3 inline -mt-0.5 mr-0.5" /> : null}
                  {b.status.replace("_", " ")}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div><div className="text-muted-foreground">Total</div><div className="font-semibold">{formatINR(Number(b.total_amount))}</div></div>
                <div><div className="text-muted-foreground">Paid</div><div className="font-semibold text-success dark:text-success">{formatINR(Number(b.amount_paid))}</div></div>
                <div><div className="text-muted-foreground">Due</div><div className="font-semibold text-destructive dark:text-destructive">{formatINR(Number(b.balance_due))}</div></div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
