import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatINR, formatDateIN } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];

interface BaseProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  booking: Booking;
  onDone?: () => void;
}

async function logActivity(leadId: string, action: string, note: string | null, userId?: string | null) {
  await supabase.from("activity_logs").insert({
    lead_id: leadId, action, action_type: "system", note, performed_by: userId ?? null,
  });
}

// ───────────────── Cheque clearing ─────────────────
export function ChequeClearDialog({ open, onOpenChange, booking, onDone }: BaseProps) {
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [bounced, setBounced] = useState(false);
  const [notes, setNotes] = useState("");

  const submit = async () => {
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      // Find the cheque payment
      const { data: pays } = await supabase.from("payments")
        .select("*").eq("booking_id", booking.id).eq("type", "cheque").is("deleted_at", null).limit(1);
      const cheque = pays?.[0];

      if (bounced) {
        if (cheque) {
          await supabase.from("payments").update({ status: "bounced", notes }).eq("id", cheque.id);
        }
        await supabase.from("bookings").update({
          status: "disputed", dispute_reason: notes || "Cheque bounced",
          disputed_at: now,
        }).eq("id", booking.id);
        await logActivity(booking.lead_id, "Cheque bounced", notes || null, profile?.id);
        toast.error("Marked as bounced");
      } else {
        if (cheque) {
          await supabase.from("payments").update({
            status: "received", received_at: now, notes,
          }).eq("id", cheque.id);
        }
        const paid = Number(booking.amount_paid) + Number(cheque?.amount ?? 0);
        await supabase.from("bookings").update({
          status: "confirmed",
          cheque_cleared_at: now,
          cheque_cleared_by: profile?.id ?? null,
          amount_paid: paid,
          balance_due: Math.max(0, Number(booking.total_amount) - paid),
        }).eq("id", booking.id);
        await logActivity(booking.lead_id, "Cheque cleared", notes || null, profile?.id);
        toast.success("Cheque cleared, booking confirmed");
      }
      onDone?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Cheque status</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-md border p-3 bg-muted/30">
            <div>Cheque: <span className="font-medium">{booking.cheque_number ?? "—"}</span></div>
            <div>Bank: {booking.cheque_bank ?? "—"}</div>
            <div>Expected clear: {formatDateIN(booking.cheque_clear_date)}</div>
          </div>
          <div className="flex gap-2">
            <Button variant={!bounced ? "default" : "outline"} className="flex-1 min-h-11" onClick={() => setBounced(false)}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Cleared
            </Button>
            <Button variant={bounced ? "destructive" : "outline"} className="flex-1 min-h-11" onClick={() => setBounced(true)}>
              <AlertTriangle className="h-4 w-4 mr-1.5" /> Bounced
            </Button>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="min-h-11">
            {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────── Cancellation ─────────────────
export function CancelBookingDialog({ open, onOpenChange, booking, onDone }: BaseProps) {
  const { profile } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [reason, setReason] = useState("");
  const [refundReference, setRefundReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from("companies").select("*").eq("id", booking.company_id).single()
      .then(({ data }) => setCompany(data as Company));
  }, [open, booking.company_id]);

  const daysOut = useMemo(() => {
    const d = new Date(booking.event_date).getTime();
    return Math.ceil((d - Date.now()) / 86400000);
  }, [booking.event_date]);

  const tier = useMemo(() => {
    if (!company) return { percent: 0, label: "" };
    if (daysOut >= 30) return { percent: Number(company.refund_over_30_percent), label: "30+ days out" };
    if (daysOut >= 15) return { percent: Number(company.refund_15_30_percent), label: "15–30 days out" };
    return { percent: Number(company.refund_under_15_percent), label: "Under 15 days" };
  }, [company, daysOut]);

  const refundAmount = useMemo(
    () => Math.round((Number(booking.amount_paid) * tier.percent) / 100),
    [booking.amount_paid, tier.percent]
  );

  const submit = async () => {
    if (!reason.trim()) { toast.error("Reason required"); return; }
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      await supabase.from("bookings").update({
        status: "cancelled",
        cancelled_at: now,
        cancellation_reason: reason,
        refund_percent: tier.percent,
        refund_amount: refundAmount,
        refund_reference: refundReference || null,
        refund_status: refundAmount > 0 ? (refundReference ? "processed" : "pending") : "none",
        refund_processed_at: refundReference ? now : null,
        refund_processed_by: refundReference ? profile?.id ?? null : null,
      }).eq("id", booking.id);

      // Cancel pending payments + reminders
      await supabase.from("payments").update({ status: "refunded" })
        .eq("booking_id", booking.id).eq("status", "pending");
      await supabase.from("payment_reminders").update({ is_cancelled: true })
        .eq("booking_id", booking.id).eq("is_sent", false);

      // Release slot
      await supabase.from("slots").update({
        status: "free", confirmed_by_booking_id: null, held_by_lead_id: null, held_by_requirement_id: null, held_until: null,
      }).eq("confirmed_by_booking_id", booking.id);

      // Unlock the lead
      await supabase.from("leads").update({ status: "negative" }).eq("id", booking.lead_id);

      await logActivity(booking.lead_id, "Booking cancelled",
        `${reason}\nRefund: ${formatINR(refundAmount)} (${tier.percent}%) — ${tier.label}`, profile?.id);

      toast.success("Booking cancelled");
      onDone?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Cancel booking</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-md border p-3 bg-amber-500/5 border-amber-500/30">
            <div className="text-xs text-muted-foreground">Event in</div>
            <div className="font-semibold">{daysOut} days · {tier.label || "—"}</div>
            <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
              <div><div className="text-muted-foreground">Paid</div><div className="font-semibold">{formatINR(Number(booking.amount_paid))}</div></div>
              <div><div className="text-muted-foreground">Refund ({tier.percent}%)</div><div className="font-semibold text-emerald-700 dark:text-emerald-400">{formatINR(refundAmount)}</div></div>
            </div>
          </div>
          <div>
            <Label className="text-xs">Reason *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Why is this booking being cancelled?" />
          </div>
          {refundAmount > 0 && (
            <div>
              <Label className="text-xs">Refund reference (optional)</Label>
              <Input value={refundReference} onChange={(e) => setRefundReference(e.target.value)} placeholder="UTR / cheque number" className="min-h-11" />
              <p className="text-[11px] text-muted-foreground mt-1">Leave empty to mark refund as pending.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Back</Button>
          <Button variant="destructive" onClick={submit} disabled={submitting} className="min-h-11">
            {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Confirm cancellation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────── Reschedule ─────────────────
export function RescheduleBookingDialog({ open, onOpenChange, booking, onDone }: BaseProps) {
  const { profile } = useAuth();
  const [date, setDate] = useState(booking.event_date);
  const [start, setStart] = useState(booking.start_time ?? "");
  const [end, setEnd] = useState(booking.end_time ?? "");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(booking.event_date);
      setStart(booking.start_time ?? "");
      setEnd(booking.end_time ?? "");
      setReason("");
    }
  }, [open, booking]);

  const submit = async () => {
    if (!date) { toast.error("Pick a date"); return; }
    if (date === booking.event_date && start === (booking.start_time ?? "") && end === (booking.end_time ?? "")) {
      toast.error("No changes"); return;
    }
    setSubmitting(true);
    try {
      // Conflict check on the new slot
      if (start && end) {
        const { data: conflict } = await supabase.from("slots").select("id,status")
          .eq("company_id", booking.company_id).eq("event_date", date)
          .neq("status", "free").lt("start_time", end).gt("end_time", start);
        const blocking = (conflict ?? []).find((s) => s.status === "confirmed");
        if (blocking) {
          toast.error("That slot is already confirmed for another booking");
          setSubmitting(false);
          return;
        }
      }

      await supabase.from("bookings").update({
        event_date: date,
        start_time: start || null,
        end_time: end || null,
        rescheduled_from_date: booking.event_date,
        rescheduled_from_start_time: booking.start_time,
        status: "rescheduled",
      }).eq("id", booking.id);

      // Free old slot, create/confirm new
      await supabase.from("slots").update({
        status: "free", confirmed_by_booking_id: null, held_by_lead_id: null, held_by_requirement_id: null, held_until: null,
      }).eq("confirmed_by_booking_id", booking.id);

      if (start && end) {
        await supabase.from("slots").insert({
          company_id: booking.company_id, event_date: date,
          start_time: start, end_time: end,
          status: "confirmed", confirmed_by_booking_id: booking.id,
        });
      }

      await logActivity(booking.lead_id, "Booking rescheduled",
        `From ${formatDateIN(booking.event_date)} → ${formatDateIN(date)}${reason ? "\n" + reason : ""}`,
        profile?.id);

      toast.success("Rescheduled");
      onDone?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Reschedule booking</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="text-xs text-muted-foreground">
            Current: <span className="font-medium text-foreground">{formatDateIN(booking.event_date)}</span>
            {booking.start_time && ` · ${booking.start_time} – ${booking.end_time}`}
          </div>
          <div>
            <Label className="text-xs">New date *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="min-h-11" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Start</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="min-h-11" />
            </div>
            <div>
              <Label className="text-xs">End</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="min-h-11" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Reason (optional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why is this being moved?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="min-h-11">
            {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Reschedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
