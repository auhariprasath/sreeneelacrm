import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { SkeletonList } from "@/components/skeleton-list";
import { EmptyState } from "@/components/empty-state";
import { formatDateTimeIN } from "@/lib/format";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Notif = Database["public"]["Tables"]["notifications"]["Row"];

export const Route = createFileRoute("/_app/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "unread">("all");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200);
    if (tab === "unread") q = q.eq("is_read", false);
    const { data } = await q;
    setItems((data as Notif[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, tab]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`notif-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [user?.id]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  };

  const markAllRead = async () => {
    if (!user) return;
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    if (error) toast.error(error.message);
  };

  const handleClick = async (n: Notif) => {
    if (!n.is_read) await markRead(n.id);
    if (n.lead_id) navigate({ to: "/leads/$leadId", params: { leadId: n.lead_id } });
  };

  const grouped = groupByDay(items);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Notifications</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Alerts for your leads, transfers, and follow-ups.</p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead} className="min-h-11">
          <CheckCheck className="h-4 w-4 mr-1.5" /> Mark all read
        </Button>
      </div>

      <div className="flex gap-2">
        {(["all", "unread"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-9 px-3 rounded-full text-xs font-medium border min-h-[44px] md:min-h-9 ${
              tab === t ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
            }`}
          >
            {t === "all" ? "All" : "Unread"}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList rows={6} />
      ) : items.length === 0 ? (
        <EmptyState title="You're all caught up" description="No notifications yet." />
      ) : (
        <div className="space-y-5">
          {grouped.map(([day, rows]) => (
            <div key={day} className="space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{day}</div>
              {rows.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left bg-card border rounded-lg p-3 flex items-start gap-3 hover:bg-accent/40 transition-colors min-h-[44px] ${
                    n.is_read ? "opacity-80" : ""
                  }`}
                >
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${n.is_read ? "bg-muted" : "bg-primary/15"}`}>
                    <Bell className={`h-4 w-4 ${n.is_read ? "text-muted-foreground" : "text-primary"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-sm truncate">{n.title}</div>
                      {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">{formatDateTimeIN(n.created_at)}</div>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByDay(items: Notif[]): [string, Notif[]][] {
  const map = new Map<string, Notif[]>();
  const today = new Date(); today.setHours(0,0,0,0);
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  for (const n of items) {
    const d = new Date(n.created_at); d.setHours(0,0,0,0);
    const label = d.getTime() === today.getTime() ? "Today"
      : d.getTime() === yest.getTime() ? "Yesterday"
      : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(n);
  }
  return Array.from(map.entries());
}
