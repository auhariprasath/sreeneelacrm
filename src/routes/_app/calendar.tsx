import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDashboardRealtime } from "@/hooks/use-dashboard-realtime";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { formatTimeOfDay, formatDateIN } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type Slot = Database["public"]["Tables"]["slots"]["Row"];

interface BookingSummary {
  id: string;
  event_date: string;
  start_time: string | null;
  event_type: string | null;
  lead_id: string;
  status: string;
  company_id: string;
  lead_name: string;
  company_name?: string;
}

export const Route = createFileRoute("/_app/calendar")({ component: CalendarPage });

function CalendarPage() {
  const { profile, role, activeCompanyId, companies } = useAuth();

  // Super admin can view all companies or a single one
  const [viewCompanyId, setViewCompanyId] = useState<string | null>(() =>
    role === "super_admin" ? (activeCompanyId ?? null) : (profile?.company_id ?? companies[0]?.id ?? null),
  );

  const companyId = role === "super_admin" ? viewCompanyId : (profile?.company_id ?? companies[0]?.id ?? null);

  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthStart = cursor;
  const monthEnd = endOfMonth(cursor);

  const load = useCallback(async () => {
    setLoading(true);
    const startISO = toISO(monthStart);
    const endISO = toISO(monthEnd);

    let slotsQ = supabase
      .from("slots").select("*")
      .gte("event_date", startISO)
      .lte("event_date", endISO)
      .order("event_date").order("start_time");
    if (companyId) slotsQ = slotsQ.eq("company_id", companyId);
    const { data: slotsData } = await slotsQ;
    const slotList = (slotsData as Slot[]) ?? [];
    setSlots(slotList);

    // Load confirmed bookings with lead name
    let bkQ = supabase
      .from("bookings")
      .select("id, event_date, start_time, event_type, lead_id, status, company_id, leads!inner(full_name, company_id)")
      .gte("event_date", startISO)
      .lte("event_date", endISO)
      .in("status", ["confirmed", "cheque_pending"])
      .is("deleted_at", null)
      .order("event_date").order("start_time");
    if (companyId) bkQ = bkQ.eq("company_id", companyId);
    const { data: bkData } = await bkQ;

    const companyMap: Record<string, string> = {};
    companies.forEach((c) => { companyMap[c.id] = c.name; });

    setBookings(
      ((bkData ?? []) as any[]).map((b) => ({
        id: b.id,
        event_date: b.event_date,
        start_time: b.start_time,
        event_type: b.event_type,
        lead_id: b.lead_id,
        status: b.status,
        company_id: b.company_id,
        lead_name: b.leads?.full_name ?? "—",
        company_name: companyMap[b.company_id],
      })),
    );

    setLoading(false);
  }, [companyId, monthStart, monthEnd, companies]);

  useEffect(() => { load(); }, [load]);
  useDashboardRealtime(["slots", "bookings"], load);

  const byDate = useMemo(() => {
    const m = new Map<string, Slot[]>();
    slots.forEach((s) => {
      const arr = m.get(s.event_date) ?? [];
      arr.push(s);
      m.set(s.event_date, arr);
    });
    return m;
  }, [slots]);

  const bookingsByDate = useMemo(() => {
    const m = new Map<string, BookingSummary[]>();
    bookings.forEach((b) => {
      const arr = m.get(b.event_date) ?? [];
      arr.push(b);
      m.set(b.event_date, arr);
    });
    return m;
  }, [bookings]);

  const days = buildMonthGrid(cursor);
  const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const todayISO = toISO(new Date());

  const daySlots = selectedDate ? (byDate.get(selectedDate) ?? []) : [];
  const dayBookings = selectedDate ? (bookingsByDate.get(selectedDate) ?? []) : [];

  // Upcoming confirmed bookings from today onwards
  const todayMs = new Date(todayISO).getTime();
  const upcoming = useMemo(
    () => bookings.filter((b) => new Date(b.event_date).getTime() >= todayMs)
      .sort((a, b) => a.event_date.localeCompare(b.event_date) || (a.start_time ?? "").localeCompare(b.start_time ?? "")),
    [bookings, todayMs],
  );

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <CalendarDays className="h-5 w-5" /> Calendar
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          {role === "super_admin" && (
            <Select
              value={viewCompanyId ?? "__all"}
              onValueChange={(v) => setViewCompanyId(v === "__all" ? null : v)}
            >
              <SelectTrigger className="h-9 text-sm w-48">
                <SelectValue placeholder="All companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All companies</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
      </div>

      <Legend />

      <div className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground text-center">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map(({ date, inMonth }, i) => {
          const iso = toISO(date);
          const ds = byDate.get(iso) ?? [];
          const bks = bookingsByDate.get(iso) ?? [];
          const counts = countByStatus(ds);
          const isToday = iso === todayISO;
          const isSelected = iso === selectedDate;
          const conflict = counts.confirmed >= 2 || bks.length >= 2;
          return (
            <button
              key={i}
              onClick={() => setSelectedDate(iso)}
              className={`relative min-h-[72px] md:min-h-[90px] border rounded-md p-1.5 text-left transition-colors
                ${inMonth ? "bg-card" : "bg-muted/30 text-muted-foreground"}
                ${conflict ? "border-destructive ring-1 ring-destructive/60" : ""}
                ${isSelected ? "border-primary ring-1 ring-primary" : "hover:border-primary/40"}`}
              title={conflict ? `${bks.length} confirmed bookings — double booking` : undefined}
            >
              {conflict && (
                <span className="absolute top-1 right-1 text-[9px] font-bold text-destructive rounded px-0.5">⚠</span>
              )}
              <div className={`text-xs font-medium ${isToday ? "text-primary" : ""}`}>
                {date.getDate()}
              </div>
              {/* Show up to 2 event labels */}
              <div className="mt-0.5 space-y-0.5">
                {bks.slice(0, 2).map((b) => (
                  <div key={b.id} className="text-[10px] leading-tight truncate bg-destructive/15 text-destructive dark:text-destructive rounded px-1">
                    {b.event_type ?? "Event"}
                  </div>
                ))}
                {bks.length === 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {counts.confirmed > 0 && <Dot tone="bg-destructive" n={counts.confirmed} />}
                    {counts.enquiry > 0 && <Dot tone="bg-warning" n={counts.enquiry} />}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day panel */}
      <div className="bg-card border rounded-lg p-4">
        <div className="text-sm font-medium mb-2">
          {selectedDate ? formatDateIN(selectedDate) : "Pick a date to see details"}
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : selectedDate && dayBookings.length === 0 && daySlots.length === 0 ? (
          <div className="text-sm text-muted-foreground">No bookings or held slots for this date.</div>
        ) : (
          <div className="space-y-2">
            {dayBookings.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Confirmed bookings</div>
                {dayBookings.map((b) => (
                  <div key={b.id} className={`flex items-center justify-between gap-3 border rounded-md p-2.5 ${dayBookings.length >= 2 ? "border-destructive/40 bg-destructive/5" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                        <StatusDot status={b.status} />
                        {b.event_type ?? "Event"}
                        {b.start_time && <span className="text-muted-foreground font-normal text-xs">{formatTimeOfDay(b.start_time)}</span>}
                        {dayBookings.length >= 2 && <span className="text-[10px] text-destructive font-semibold">DOUBLE BOOKING</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {b.lead_name}
                        {!companyId && b.company_name && <span className="ml-1 text-[10px] bg-muted px-1 rounded">{b.company_name}</span>}
                      </div>
                    </div>
                    <Link to="/leads/$leadId" params={{ leadId: b.lead_id }} className="text-xs text-primary hover:underline shrink-0">Open</Link>
                  </div>
                ))}
              </div>
            )}
            {daySlots.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Venue slots</div>
                {daySlots.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 border rounded-md p-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <StatusDot status={s.status} />
                      <div className="text-sm">
                        {s.session_name ? <span className="font-medium">{s.session_name} · </span> : null}
                        {formatTimeOfDay(s.start_time)} – {formatTimeOfDay(s.end_time)}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">{s.status.replace("_", " ")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm font-semibold mb-3">Upcoming confirmed events</div>
          <div className="space-y-2">
            {upcoming.slice(0, 15).map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 text-sm border-b last:border-0 pb-2 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{b.event_type ?? "Event"}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateIN(b.event_date)}
                    {b.start_time && ` · ${formatTimeOfDay(b.start_time)}`}
                    {" · "}{b.lead_name}
                    {!companyId && b.company_name && <span className="ml-1 text-[10px] bg-muted px-1 rounded">{b.company_name}</span>}
                  </div>
                </div>
                <Link to="/leads/$leadId" params={{ leadId: b.lead_id }} className="text-xs text-primary hover:underline shrink-0">Open</Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" /> Confirmed booking</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" /> Enquiry slot</span>
      <span className="inline-flex items-center gap-1.5 text-destructive"><span>⚠</span> Double booking</span>
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
    status === "confirmed" ? "bg-destructive"
    : status === "cheque_pending" ? "bg-warning"
    : status === "enquiry" ? "bg-warning"
    : "bg-muted-foreground";
  return <span className={`h-2 w-2 rounded-full shrink-0 ${tone}`} />;
}

function countByStatus(ds: Slot[]) {
  return ds.reduce(
    (acc, s) => { (acc as any)[s.status] = ((acc as any)[s.status] ?? 0) + 1; return acc; },
    { confirmed: 0, enquiry: 0, free: 0 } as Record<string, number>,
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
