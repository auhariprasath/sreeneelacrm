import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatINR } from "@/lib/format";
import { generateTasksForBooking } from "@/lib/task-templates";
import type { Database } from "@/integrations/supabase/types";

type PaymentMethod = "cash" | "cheque" | "bank_transfer" | "upi" | "razorpay";
type PaymentType = Database["public"]["Enums"]["payment_type"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quotationId: string | null;
  defaultMethod?: PaymentMethod;
  onConfirmed?: (bookingId: string) => void;
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "upi", label: "UPI" },
  { value: "razorpay", label: "Razorpay link" },
];

export function PaymentReceivedDialog({ open, onOpenChange, quotationId, defaultMethod, onConfirmed }: Props) {
  const { profile } = useAuth();
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod ?? "cash");
  const [reference, setReference] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!open || !quotationId) return;
    setMethod(defaultMethod ?? "cash");
    setReference(""); setChequeNumber(""); setChequeBank("");
    (async () => {
      const { data } = await supabase.from("quotations").select("total").eq("id", quotationId).maybeSingle();
      setTotal(Number(data?.total ?? 0));
    })();
  }, [open, quotationId, defaultMethod]);

  const confirm = async () => {
    if (!quotationId) return;
    if (method === "cheque" && (!chequeNumber.trim() || !chequeBank.trim())) {
      toast.error("Cheque number and bank are required"); return;
    }
    setSubmitting(true);
    try {
      const { data: quote } = await supabase.from("quotations").select("*").eq("id", quotationId).maybeSingle();
      if (!quote) throw new Error("Quotation not found");
      const { data: requirement } = await supabase.from("requirements").select("*").eq("id", quote.requirement_id).maybeSingle();
      if (!requirement) throw new Error("Requirement not found");

      const totalAmount = Number(quote.total);

      // Double-booking guard
      const { data: existing } = await supabase
        .from("bookings")
        .select("id")
        .eq("company_id", quote.company_id)
        .eq("event_date", requirement.event_date!)
        .in("status", ["confirmed", "cheque_pending"])
        .is("deleted_at", null)
        .neq("lead_id", quote.lead_id);
      if (existing && existing.length > 0) {
        toast.error("This venue already has a confirmed booking on the same date. Double booking prevented.", { duration: 5000 });
        setSubmitting(false);
        return;
      }

      // Map UI method → DB enum payment_type
      const paymentType: PaymentType = method as PaymentType;

      const { data: booking, error: bErr } = await supabase.from("bookings").insert({
        lead_id: quote.lead_id,
        requirement_id: quote.requirement_id,
        quotation_id: quote.id,
        company_id: quote.company_id,
        status: "confirmed",
        event_date: requirement.event_date!,
        start_time: requirement.start_time,
        end_time: requirement.end_time,
        total_amount: totalAmount,
        amount_paid: totalAmount,
        balance_due: 0,
        payment_type: paymentType,
        cheque_number: method === "cheque" ? chequeNumber : null,
        cheque_bank: method === "cheque" ? chequeBank : null,
        created_by: profile?.id ?? null,
      }).select("*").single();
      if (bErr || !booking) throw new Error(bErr?.message || "Couldn't create booking");

      const { error: pErr } = await supabase.from("payments").insert({
        booking_id: booking.id,
        lead_id: quote.lead_id,
        company_id: quote.company_id,
        type: paymentType,
        amount: totalAmount,
        status: "received",
        received_at: new Date().toISOString(),
        transaction_reference: reference.trim() || null,
        cheque_number: method === "cheque" ? chequeNumber : null,
        cheque_bank: method === "cheque" ? chequeBank : null,
        created_by: profile?.id ?? null,
      });
      if (pErr) throw new Error(pErr.message);

      // Confirm the slot held by this requirement
      await supabase.from("slots").update({
        status: "confirmed",
        confirmed_by_booking_id: booking.id,
        held_until: null,
      }).eq("held_by_requirement_id", quote.requirement_id);

      // Lock the lead
      await supabase.from("leads").update({ status: "locked" }).eq("id", quote.lead_id);

      // Remember selected method on the quotation/invoice
      await supabase.from("quotations").update({ selected_payment_method: method }).eq("id", quotationId);

      // Activity log
      await supabase.from("activity_logs").insert({
        lead_id: quote.lead_id,
        action: `Payment received · ${METHODS.find((m) => m.value === method)?.label} · ${formatINR(totalAmount)} — booking confirmed`,
        action_type: "status_change",
        performed_by: profile?.id ?? null,
        metadata: { booking_id: booking.id, quotation_id: quote.id, method },
      });

      // Generate task board
      try {
        await generateTasksForBooking({
          bookingId: booking.id,
          companyId: quote.company_id,
          eventDate: requirement.event_date!,
          startTime: requirement.start_time,
          createdBy: profile?.id ?? null,
        });
      } catch (e) { console.warn("Task generation failed:", e); }

      toast.success("Payment recorded — booking confirmed");
      onConfirmed?.(booking.id);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't record payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> Payment received
          </DialogTitle>
        </DialogHeader>
        <div className="p-4 space-y-4">
          <div className="bg-muted/40 border rounded-md p-3 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-semibold">{formatINR(total)}</span>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Which method did they pay by?</Label>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={`text-sm text-left border rounded-md p-2.5 transition-colors ${method === m.value ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-muted/40"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {method === "cheque" ? (
            <div className="grid grid-cols-2 gap-2">
              <Input value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} placeholder="Cheque number *" />
              <Input value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} placeholder="Bank *" />
            </div>
          ) : method !== "cash" ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Reference (optional)</Label>
              <div className="relative">
                <IndianRupee className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI ref / transaction id" className="pl-7" />
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter className="border-t p-3 gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={confirm} disabled={submitting} className="min-h-11">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
            Confirm booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
