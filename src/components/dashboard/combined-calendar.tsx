import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDateIN, formatTimeOfDay } from "@/lib/format";

interface CalBooking {
  id: string;
  lead_id: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  company_id: string;
  company_name: string;
  brand_color: string;
  full_name: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

export function CombinedCalendar() {
  const [cursor, setCursor] = useState(() => new Date());
  const [bookings, setBookings] = useState<CalBooking[]>([]);
  const [openDate, setOpenDate] = useState<string | null>(null);

  const mKey = monthKey(cursor);
  const startStr = startOfMonth(cursor).toISOString().slice(0, 10);
  const endStr = endOfMonth(cursor).toISOString().slice(0, 10);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, lead_id, event_date, start_time, end_time, venue, company_id, companies(name, brand_color), leads(full_name)")
        .is("deleted_at", null)
        .in("status", ["confirmed", "completed", "rescheduled"])
        .gte("event_date", startStr)
        .lte("event_date", endStr);
      if (cancelled) return;
      setBookings((data ?? []).map((b: any) => ({
        id: b.id, lead_id: b.lead_id, event_date: b.event_date,
        start_time: b.start_time, end_time: b.end_time, venue: b.venue,
        company_id: b.company_id,
        company_name: b.companies?.name ?? "—",
        brand_color: b.companies?.brand_color ?? "#6366f1",
        full_name: b.leads?.full_name ?? "—",
      })));
    };
    load();
    const ch = supabase.channel(`cal-${mKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [mKey, startStr, endStr]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalBooking[]>();
    bookings.forEach((b) => {
      const list = m.get(b.event_date) ?? [];
      list.push(b);
      m.set(b.event_date, list);
    });
    return m;
  }, [bookings]);

  // Build grid: pad with leading blanks for first day-of-week
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const leading = monthStart.getDay();
  const cells: Array<{ date: string; day: number; inMonth: boolean }> = [];
  for (let i = 0; i < leading; i++) cells.push({ date: "", day: 0, inMonth: false });
  for (let d = 1; d <= monthEnd.getDate(); d++) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), d).toISOString().slice(0, 10);
    cells.push({ date, day: d, inMonth: true });
  }
  while (cells.length % 7 !== 0) cells.push({ date: "", day: 0, inMonth: false });

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthLabel = cursor.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const openDayBookings = openDate ? (byDay.get(openDate) ?? []).slice().sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? "")) : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">All bookings · {monthLabel}</CardTitle>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCursor(new Date())}>Today</Button>
          <Button size="icon" variant="ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-px text-center text-xs text-muted-foreground mb-1">
          {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-px bg-border rounded overflow-hidden">
          {cells.map((c, i) => {
            if (!c.inMonth) return <div key={i} className="bg-background aspect-square sm:aspect-auto sm:min-h-[72px]" />;
            const list = byDay.get(c.date) ?? [];
            const isToday = c.date === todayStr;
            return (
              <button
                key={i}
                onClick={() => list.length && setOpenDate(c.date)}
                className={`bg-background aspect-square sm:aspect-auto sm:min-h-[72px] p-1 text-left flex flex-col gap-1 transition-colors ${list.length ? "hover:bg-accent/40 cursor-pointer" : ""} ${isToday ? "ring-1 ring-primary ring-inset" : ""}`}
              >
                <span className={`text-xs ${isToday ? "font-semibold text-primary" : "text-foreground"}`}>{c.day}</span>
                <div className="flex flex-wrap gap-0.5 mt-auto">
                  {list.slice(0, 4).map((b) => (
                    <Popover key={b.id}>
                      <PopoverTrigger asChild>
                        <span
                          onClick={(e) => e.stopPropagation()}
                          className="h-2 w-2 rounded-full inline-block cursor-pointer"
                          style={{ background: b.brand_color }}
                          aria-label={`${b.full_name} · ${b.company_name}`}
                        />
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="text-sm font-medium">{b.full_name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {b.company_name}{b.start_time ? ` · ${formatTimeOfDay(b.start_time)}` : ""}
                        </div>
                        {b.venue && <div className="text-xs text-muted-foreground">{b.venue}</div>}
                        <Link to="/leads/$leadId" params={{ leadId: b.lead_id }} className="text-xs text-primary underline mt-2 inline-block">
                          Open booking →
                        </Link>
                      </PopoverContent>
                    </Popover>
                  ))}
                  {list.length > 4 && (
                    <span className="text-[10px] text-muted-foreground ml-0.5">+{list.length - 4}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>

      <Sheet open={!!openDate} onOpenChange={(o) => !o && setOpenDate(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{openDate ? formatDateIN(openDate) : ""}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {openDayBookings.length === 0 ? (
              <div className="text-sm text-muted-foreground">No bookings</div>
            ) : openDayBookings.map((b) => (
              <Link
                key={b.id}
                to="/leads/$leadId"
                params={{ leadId: b.lead_id }}
                onClick={() => setOpenDate(null)}
                className="flex items-start gap-3 rounded-lg border p-3 hover:bg-accent/40"
              >
                <span className="h-3 w-3 rounded-full mt-1 shrink-0" style={{ background: b.brand_color }} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{b.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {b.start_time ? formatTimeOfDay(b.start_time) : "Time TBD"}
                    {b.end_time ? `–${formatTimeOfDay(b.end_time)}` : ""}
                    {` · ${b.company_name}`}
                  </div>
                  {b.venue && <div className="text-xs text-muted-foreground truncate">{b.venue}</div>}
                </div>
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
