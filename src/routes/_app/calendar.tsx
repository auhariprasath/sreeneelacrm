import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const detailPanelRef = useRef<HTMLDivElement>(null);

  // Scroll the detail panel into view whenever a date is selected
  useEffect(() => {
    if (selectedDate && detailPanelRef.current) {
      detailPanelRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedDate]);

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

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 text-[11px] font-semibold text-muted-foreground text-center px-0.5">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ date, inMonth }, i) => {
          const iso = toISO(date);
          const ds = byDate.get(iso) ?? [];
          const bks = bookingsByDate.get(iso) ?? [];
          const counts = countByStatus(ds);
          const isToday = iso === todayISO;
          const isSelected = iso === selectedDate;
          const conflict = bks.length >= 2;
          const hasBooking = bks.length > 0;
          const hasSlot = ds.length > 0;

          return (
            <button
              key={i}
              onClick={() => setSelectedDate(iso === selectedDate ? null : iso)}
              className={[
                "relative min-h-[80px] md:min-h-[100px] border rounded-lg p-1.5 text-left transition-all",
                inMonth ? "bg-card hover:shadow-sm" : "bg-muted/20 text-muted-foreground/60",
                conflict ? "border-destructive/60 bg-destructive/5 ring-1 ring-destructive/40" : "",
                isSelected ? "border-primary ring-2 ring-primary/40 shadow-sm" : !conflict ? "hover:border-primary/50" : "",
                isToday && !isSelected ? "border-primary/40" : "",
              ].filter(Boolean).join(" ")}
              title={conflict ? "⚠ Double booking detected" : undefined}
            >
              {/* Date number */}
              <div className={[
                "h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold mb-0.5",
                isToday ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/50",
              ].join(" ")}>
                {date.getDate()}
              </div>

              {/* Event chips — show up to 2 */}
              <div className="space-y-0.5">
                {bks.slice(0, 2).map((b) => (
                  <div
                    key={b.id}
                    className={[
                      "text-[9px] md:text-[10px] leading-tight truncate rounded px-1 py-0.5 font-medium",
                      b.status === "cheque_pending"
                        ? "bg-warning/20 text-warning dark:text-warning"
                        : "bg-primary/15 text-primary dark:text-primary",
                    ].join(" ")}
                  >
                    {b.event_type ?? "Event"}
                  </div>
                ))}
                {bks.length > 2 && (
                  <div className="text-[9px] text-muted-foreground px-1">+{bks.length - 2} more</div>
                )}
                {/* Dots for slots when no bookings */}
                {!hasBooking && hasSlot && (
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {counts.confirmed > 0 && <Dot tone="bg-success" n={counts.confirmed} />}
                    {counts.enquiry > 0 && <Dot tone="bg-warning" n={counts.enquiry} />}
                  </div>
                )}
              </div>

              {/* Double booking badge */}
              {conflict && (
                <span className="absolute top-1 right-1 text-[9px] font-bold text-destructive">⚠</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day panel */}
      {selectedDate && (
        <div ref={detailPanelRef} className="bg-card border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">{formatDateIN(selectedDate)}</div>
            <button type="button" onClick={() => setSelectedDate(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : dayBookings.length === 0 && daySlots.length === 0 ? (
            <div className="text-sm text-muted-foreground py-3 text-center">No bookings or held slots for this date.</div>
          ) : (
            <div className="space-y-3">
              {dayBookings.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    Confirmed Bookings
                    {dayBookings.length >= 2 && (
                      <span className="bg-destructive/15 text-destructive text-[10px] font-bold px-1.5 py-0.5 rounded">
                        ⚠ Double Booking
                      </span>
                    )}
                  </div>
                  {dayBookings.map((b) => (
                    <div
                      key={b.id}
                      className={[
                        "flex items-center justify-between gap-3 rounded-lg p-3 border",
                        dayBookings.length >= 2 ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30",
                      ].join(" ")}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${b.status === "cheque_pending" ? "bg-warning" : "bg-primary"}`} />
                          {b.event_type ?? "Event"}
                          {b.start_time && (
                            <span className="text-xs text-muted-foreground font-normal bg-muted px-1.5 py-0.5 rounded">
                              {formatTimeOfDay(b.start_time)}
                            </span>
                          )}
                          {b.status === "cheque_pending" && (
                            <span className="text-[10px] bg-warning/20 text-warning px-1.5 py-0.5 rounded">Cheque pending</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                          <span>{b.lead_name}</span>
                          {!companyId && b.company_name && (
                            <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded">{b.company_name}</span>
                          )}
                        </div>
                      </div>
                      <Link
                        to="/leads/$leadId"
                        params={{ leadId: b.lead_id }}
                        className="shrink-0 text-xs text-primary hover:underline font-medium"
                      >
                        Open →
                      </Link>
                    </div>
                  ))}
                </div>
              )}

              {daySlots.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Venue Slots</div>
                  {daySlots.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusDot status={s.status} />
                        <div>
                          <div className="text-sm font-medium">
                            {s.session_name ?? "Session"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatTimeOfDay(s.start_time)} – {formatTimeOfDay(s.end_time)}
                          </div>
                        </div>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                        s.status === "confirmed" ? "bg-primary/15 text-primary"
                        : s.status === "enquiry" ? "bg-warning/15 text-warning"
                        : "bg-muted text-muted-foreground"
                      }`}>
                        {s.status.replace("_", " ")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <div className="bg-card border rounded-xl p-4">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Upcoming Events
            <span className="text-xs text-muted-foreground font-normal">({upcoming.length})</span>
          </div>
          <div className="space-y-1.5">
            {upcoming.slice(0, 15).map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-lg hover:bg-muted/40 px-2 py-2 transition-colors group">
                <div className={`h-8 w-1.5 rounded-full shrink-0 ${b.status === "cheque_pending" ? "bg-warning" : "bg-primary"}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{b.event_type ?? "Event"}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <span>{formatDateIN(b.event_date)}</span>
                    {b.start_time && <span>· {formatTimeOfDay(b.start_time)}</span>}
                    <span>· {b.lead_name}</span>
                    {!companyId && b.company_name && (
                      <span className="bg-muted px-1 rounded">{b.company_name}</span>
                    )}
                  </div>
                </div>
                <Link
                  to="/leads/$leadId"
                  params={{ leadId: b.lead_id }}
                  className="shrink-0 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:underline"
                >
                  Open →
                </Link>
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
    <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary/70" /> Confirmed</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-warning/70" /> Cheque pending</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Slot booked</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-warning" /> Slot enquiry</span>
      <span className="inline-flex items-center gap-1.5 text-destructive font-medium"><span>⚠</span> Double booking</span>
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
