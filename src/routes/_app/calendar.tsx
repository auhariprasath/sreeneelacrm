import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRealtimeRefresh } from "@/lib/realtime";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { formatTimeOfDay, formatDateIN } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type Slot = Database["public"]["Tables"]["slots"]["Row"];

export const Route = createFileRoute("/_app/calendar")({ component: CalendarPage });

function CalendarPage() {
  const { profile } = useAuth();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [leadsById, setLeadsById] = useState<Record<string, string>>({});

  const monthStart = cursor;
  const monthEnd = endOfMonth(cursor);

  const load = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    // Auto-free expired soft holds in range, then fetch
    await supabase.from("slots").update({
      status: "free", held_by_lead_id: null, held_by_requirement_id: null, held_until: null,
    }).eq("company_id", profile.company_id!).eq("status", "soft_hold").lt("held_until", new Date().toISOString());

    const { data } = await supabase
      .from("slots").select("*")
      .eq("company_id", profile.company_id!)
      .gte("event_date", toISO(monthStart))
      .lte("event_date", toISO(monthEnd))
      .order("event_date").order("start_time");
    const list = (data as Slot[]) ?? [];
    setSlots(list);

    const leadIds = Array.from(new Set(list.map((s) => s.held_by_lead_id).filter(Boolean) as string[]));
    if (leadIds.length) {
      const { data: leads } = await supabase.from("leads").select("id, full_name").in("id", leadIds);
      const map: Record<string, string> = {};
      (leads ?? []).forEach((l: any) => { map[l.id] = l.full_name; });
      setLeadsById(map);
    } else {
      setLeadsById({});
    }
    setLoading(false);
  }, [profile?.company_id, monthStart, monthEnd]);

  useEffect(() => { load(); }, [load]);

  // Live updates — slots drive the grid; bookings affect held_by/confirmed state.
  useRealtimeRefresh(["slots", "bookings"], load);


  const byDate = useMemo(() => {
    const m = new Map<string, Slot[]>();
    slots.forEach((s) => {
      const arr = m.get(s.event_date) ?? [];
      arr.push(s);
      m.set(s.event_date, arr);
    });
    return m;
  }, [slots]);

  const days = buildMonthGrid(cursor);
  const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const todayISO = toISO(new Date());

  const daySlots = selectedDate ? (byDate.get(selectedDate) ?? []) : [];

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <CalendarDays className="h-5 w-5" /> Calendar
        </h1>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[160px] text-center text-sm font-medium">{monthLabel}</div>
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>Today</Button>
        </div>
      </div>

      <Legend />

      <div className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground text-center">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map(({ date, inMonth }, i) => {
          const iso = toISO(date);
          const ds = byDate.get(iso) ?? [];
          const counts = countByStatus(ds);
          const isToday = iso === todayISO;
          const isSelected = iso === selectedDate;
          const conflict = counts.confirmed >= 2;
          return (
            <button
              key={i}
              onClick={() => setSelectedDate(iso)}
              className={`relative min-h-[68px] md:min-h-[88px] border rounded-md p-1.5 text-left transition-colors
                ${inMonth ? "bg-card" : "bg-muted/30 text-muted-foreground"}
                ${conflict ? "border-rose-500 ring-1 ring-rose-500/60" : ""}
                ${isSelected ? "border-primary ring-1 ring-primary" : "hover:border-primary/40"}`}
              title={conflict ? `${counts.confirmed} confirmed bookings on this date` : undefined}
            >
              {conflict && (
                <span className="absolute top-1 right-1 text-[9px] font-bold text-rose-600 bg-rose-100 dark:bg-rose-950 rounded px-1">
                  ⚠
                </span>
              )}
              <div className={`text-xs font-medium ${isToday ? "text-primary" : ""}`}>
                {date.getDate()}
              </div>
              <div className="mt-1 flex flex-wrap gap-0.5">
                {counts.confirmed > 0 && <Dot tone={conflict ? "bg-rose-600" : "bg-rose-500"} n={counts.confirmed} />}
                {counts.enquiry > 0 && <Dot tone="bg-amber-500" n={counts.enquiry} />}
                {counts.soft_hold > 0 && <Dot tone="bg-amber-300" n={counts.soft_hold} />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day panel */}
      <div className="bg-card border rounded-lg p-4">
        <div className="text-sm font-medium mb-2">
          {selectedDate ? formatDateIN(selectedDate) : "Pick a date to see slots"}
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : selectedDate && daySlots.length === 0 ? (
          <div className="text-sm text-muted-foreground">No slots booked or held for this date.</div>
        ) : (
          <div className="space-y-1.5">
            {daySlots.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 border rounded-md p-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusDot status={s.status} />
                  <div className="text-sm">
                    {s.session_name ? <span className="font-medium">{s.session_name} · </span> : null}
                    {formatTimeOfDay(s.start_time)} – {formatTimeOfDay(s.end_time)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 shrink-0">
                  {s.held_by_lead_id && leadsById[s.held_by_lead_id] && (
                    <Link to="/leads/$leadId" params={{ leadId: s.held_by_lead_id }} className="text-primary hover:underline">
                      {leadsById[s.held_by_lead_id]}
                    </Link>
                  )}
                  <span className="capitalize">{s.status.replace("_", " ")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> Confirmed</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Enquiry</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-300" /> Soft hold</span>
      <span className="inline-flex items-center gap-1.5 text-rose-600"><span>⚠</span> Double booking</span>
    </div>
  );
}

function Dot({ tone, n }: { tone: string; n: number }) {
  return (
    <span className={`text-[10px] text-white ${tone} rounded-full h-4 min-w-4 px-1 inline-flex items-center justify-center`}>
      {n}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const tone =
    status === "confirmed" ? "bg-rose-500"
    : status === "enquiry" ? "bg-amber-500"
    : status === "soft_hold" ? "bg-amber-300"
    : "bg-muted-foreground";
  return <span className={`h-2 w-2 rounded-full ${tone}`} />;
}

function countByStatus(ds: Slot[]) {
  return ds.reduce(
    (acc, s) => { (acc as any)[s.status] = ((acc as any)[s.status] ?? 0) + 1; return acc; },
    { confirmed: 0, enquiry: 0, soft_hold: 0, free: 0 } as Record<string, number>,
  );
}

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }

function buildMonthGrid(cursor: Date): { date: Date; inMonth: boolean }[] {
  const first = startOfMonth(cursor);
  const last = endOfMonth(cursor);
  // Monday-first: getDay() Sunday=0, Monday=1
  const startWeekday = (first.getDay() + 6) % 7;
  const startDate = new Date(first);
  startDate.setDate(first.getDate() - startWeekday);
  const totalCells = Math.ceil((startWeekday + last.getDate()) / 7) * 7;
  return Array.from({ length: totalCells }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    return { date: d, inMonth: d.getMonth() === cursor.getMonth() };
  });
}
