import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Dashboard realtime bus.
 *
 * Instead of every dashboard widget opening its own Supabase channel
 * (one per company-panel + calendar + stats + alerts + post-event + sidebar),
 * we open ONE shared channel per browser tab and fan out events to all
 * subscribers via a lightweight EventTarget.
 *
 * Tables wired: leads, bookings, tasks, slots, quotations, payments,
 * feedback, follow_ups, venue_meetings, win_loss_log, companies.
 */

export type DashboardTable =
  | "leads"
  | "bookings"
  | "tasks"
  | "slots"
  | "quotations"
  | "payments"
  | "feedback"
  | "follow_ups"
  | "venue_meetings"
  | "win_loss_log"
  | "companies";

const TABLES: DashboardTable[] = [
  "leads", "bookings", "tasks", "slots", "quotations",
  "payments", "feedback", "follow_ups", "venue_meetings",
  "win_loss_log", "companies",
];

const bus = new EventTarget();
let channel: ReturnType<typeof supabase.channel> | null = null;
let refCount = 0;

function ensureChannel() {
  if (channel) return;
  const ch = supabase.channel("dashboard-bus");
  TABLES.forEach((table) => {
    ch.on(
      "postgres_changes" as any,
      { event: "*", schema: "public", table },
      (payload: any) => {
        bus.dispatchEvent(new CustomEvent(table, { detail: payload }));
        bus.dispatchEvent(new CustomEvent("*", { detail: { table, payload } }));
      },
    );
  });
  ch.subscribe();
  channel = ch;
}

function releaseChannel() {
  if (refCount > 0) return;
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

/**
 * Subscribe to one or more dashboard tables. The callback is debounced via
 * requestAnimationFrame so a burst of postgres_changes events triggers
 * exactly one refresh per frame.
 */
export function useDashboardRealtime(
  tables: DashboardTable[] | "*",
  onChange: () => void,
) {
  useEffect(() => {
    refCount++;
    ensureChannel();

    let frame = 0;
    const handler = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        onChange();
      });
    };

    const list = tables === "*" ? (["*"] as const) : tables;
    list.forEach((t) => bus.addEventListener(t, handler));

    return () => {
      list.forEach((t) => bus.removeEventListener(t, handler));
      if (frame) cancelAnimationFrame(frame);
      refCount--;
      // Defer teardown so rapid remounts don't churn the channel.
      setTimeout(releaseChannel, 250);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.isArray(tables) ? tables.join(",") : tables]);
}
