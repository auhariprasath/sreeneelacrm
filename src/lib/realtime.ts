/**
 * Global realtime tick bus.
 *
 * Why this exists: most screens in this app fetch via direct `supabase.from(...)`
 * calls inside `useEffect` + a `load()` function — they don't use TanStack Query
 * cache keys. So we can't invalidate by queryKey. Instead, every screen that
 * cares about a table registers a small callback through `useRealtimeRefresh`,
 * and we fan out postgres-changes events to all registered listeners.
 *
 * A single Supabase channel per table is opened lazily on first listener,
 * and torn down when the last listener for that table unmounts.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RealtimeTable =
  | "leads"
  | "bookings"
  | "tasks"
  | "slots"
  | "quotations"
  | "payments"
  | "event_day_logs"
  | "follow_ups"
  | "requirements"
  | "notifications";

type Listener = () => void;

interface TableBucket {
  channel: ReturnType<typeof supabase.channel> | null;
  listeners: Set<Listener>;
  // simple coalescing — if many rows change in the same tick, fire once
  pending: ReturnType<typeof setTimeout> | null;
}

const buckets = new Map<RealtimeTable, TableBucket>();

function getBucket(table: RealtimeTable): TableBucket {
  let b = buckets.get(table);
  if (!b) {
    b = { channel: null, listeners: new Set(), pending: null };
    buckets.set(table, b);
  }
  return b;
}

function notify(table: RealtimeTable) {
  const b = buckets.get(table);
  if (!b) return;
  if (b.pending) return;
  b.pending = setTimeout(() => {
    b.pending = null;
    b.listeners.forEach((fn) => {
      try { fn(); } catch (err) { console.error("[realtime] listener error", err); }
    });
  }, 150);
}

function ensureChannel(table: RealtimeTable) {
  const b = getBucket(table);
  if (b.channel) return;
  b.channel = supabase
    .channel(`realtime:${table}`)
    .on(
      "postgres_changes" as any,
      { event: "*", schema: "public", table },
      () => notify(table),
    )
    .subscribe();
}

function teardownIfEmpty(table: RealtimeTable) {
  const b = buckets.get(table);
  if (!b || b.listeners.size > 0) return;
  if (b.channel) {
    supabase.removeChannel(b.channel);
    b.channel = null;
  }
  if (b.pending) {
    clearTimeout(b.pending);
    b.pending = null;
  }
  buckets.delete(table);
}

/**
 * Re-run `callback` whenever any of the given tables changes (insert/update/delete).
 * Coalesces bursts within ~150ms into a single call.
 *
 * @example
 * useRealtimeRefresh(["bookings", "slots"], load);
 */
export function useRealtimeRefresh(tables: RealtimeTable[], callback: Listener) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  // serialize the list so the effect only resubscribes when the set actually changes
  const key = tables.slice().sort().join(",");

  useEffect(() => {
    const list = key ? (key.split(",") as RealtimeTable[]) : [];
    const wrapped: Listener = () => cbRef.current();
    list.forEach((t) => {
      const b = getBucket(t);
      b.listeners.add(wrapped);
      ensureChannel(t);
    });
    return () => {
      list.forEach((t) => {
        const b = buckets.get(t);
        if (b) b.listeners.delete(wrapped);
        teardownIfEmpty(t);
      });
    };
  }, [key]);
}
