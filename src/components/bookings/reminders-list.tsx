import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Bell, MessageSquare, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateTimeIN } from "@/lib/format";
import { buildWaMeLink } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Reminder = Database["public"]["Tables"]["payment_reminders"]["Row"];

export function RemindersList({ bookingId, phone, onChange }: { bookingId: string; phone?: string | null; onChange?: () => void }) {
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("payment_reminders")
      .select("*").eq("booking_id", bookingId)
      .order("scheduled_at", { ascending: true });
    setItems((data as Reminder[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [bookingId]);

  const sendWA = async (r: Reminder) => {
    setBusy(r.id);
    try {
      const msg = r.message_template ?? "Friendly reminder about your upcoming payment.";
      if (phone) {
        const url = buildWaMeLink(phone, msg);
        if (url) window.open(url, "_blank");
      }
      await supabase.from("payment_reminders").update({ is_sent: true, sent_at: new Date().toISOString() }).eq("id", r.id);
      toast.success("Marked as sent");
      load(); onChange?.();
    } finally { setBusy(null); }
  };

  const cancel = async (r: Reminder) => {
    setBusy(r.id);
    try {
      await supabase.from("payment_reminders").update({ is_cancelled: true }).eq("id", r.id);
      load(); onChange?.();
    } finally { setBusy(null); }
  };

  if (loading) return <div className="text-xs text-muted-foreground">Loading reminders…</div>;
  if (items.length === 0) return null;

  const pending = items.filter((r) => !r.is_sent && !r.is_cancelled);
  if (pending.length === 0) return null;

  return (
    <div className="border-t pt-2 space-y-1.5">
      <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
        <Bell className="h-3 w-3" /> Smart reminders ({pending.length})
      </div>
      {pending.slice(0, 4).map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-2 text-xs bg-muted/40 rounded p-1.5">
          <div className="min-w-0">
            <div className="font-medium">{r.trigger_percent ? `${r.trigger_percent}% trigger` : "Reminder"}</div>
            <div className="text-muted-foreground">{formatDateTimeIN(r.scheduled_at)}</div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="outline" className="h-7 px-2" disabled={busy === r.id || !phone} onClick={() => sendWA(r)}>
              {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={busy === r.id} onClick={() => cancel(r)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
