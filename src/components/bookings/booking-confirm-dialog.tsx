import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, CheckCircle2, Loader2, IndianRupee, Calendar, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatINR, formatDateIN, formatTimeOfDay } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type Quotation = Database["public"]["Tables"]["quotations"]["Row"];
type Requirement = Database["public"]["Tables"]["requirements"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];
type PaymentType = Database["public"]["Enums"]["payment_type"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quotationId: string | null;
  onConfirmed?: (bookingId: string) => void;
}

interface Instalment { amount: number; due_date: string }

const PAYMENT_OPTIONS: { value: PaymentType; label: string; help: string }[] = [
  { value: "full", label: "Full payment", help: "Client pays the entire amount now" },
  { value: "advance_50", label: "50% advance", help: "50% now, balance before event" },
  { value: "instalment", label: "Instalments", help: "Custom split with due dates" },
  { value: "cash", label: "Cash", help: "Received in cash" },
  { value: "cheque", label: "Cheque", help: "Booking is provisional until cheque clears" },
  { value: "b2b_credit", label: "B2B credit", help: "Invoice on terms — no advance" },
];

export function BookingConfirmDialog({ open, onOpenChange, quotationId, onConfirmed }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quote, setQuote] = useState<Quotation | null>(null);
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [venue, setVenue] = useState("");

  const [paymentType, setPaymentType] = useState<PaymentType>("advance_50");
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [chequeClearDate, setChequeClearDate] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [instalments, setInstalments] = useState<Instalment[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !quotationId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: q } = await supabase.from("quotations").select("*").eq("id", quotationId).maybeSingle();
      if (!q || cancelled) { setLoading(false); return; }
      const [{ data: r }, { data: c }] = await Promise.all([
        supabase.from("requirements").select("*").eq("id", q.requirement_id).maybeSingle(),
        supabase.from("companies").select("*").eq("id", q.company_id).maybeSingle(),
      ]);
      if (cancelled) return;
      setQuote(q as Quotation);
      setRequirement(r as Requirement);
      setCompany(c as Company);
      const total = Number((q as Quotation).total);
      setAdvanceAmount(Math.round(total * 0.5));
      // default 3-instalment plan
      const today = new Date(); const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const eventDate = (r as Requirement | null)?.event_date;
      const event = eventDate ? new Date(eventDate) : new Date(today.getTime() + 90 * 86400_000);
      const mid = new Date((today.getTime() + event.getTime()) / 2);
      const beforeEvent = new Date(event.getTime() - 7 * 86400_000);
      const a = Math.round(total / 3); const b = Math.round(total / 3); const c2 = total - a - b;
      setInstalments([
        { amount: a, due_date: fmt(today) },
        { amount: b, due_date: fmt(mid) },
        { amount: c2, due_date: fmt(beforeEvent) },
      ]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, quotationId]);

  useEffect(() => {
    if (!open) {
      setQuote(null); setRequirement(null); setCompany(null);
      setPaymentType("advance_50"); setChequeNumber(""); setChequeBank(""); setChequeClearDate("");
      setTransactionRef(""); setInstalments([]); setNotes(""); setVenue("");
    }
  }, [open]);

  const total = Number(quote?.total ?? 0);
  const instalmentSum = useMemo(() => instalments.reduce((s, i) => s + (Number(i.amount) || 0), 0), [instalments]);
  const instalmentValid = paymentType !== "instalment" || Math.abs(instalmentSum - total) < 1;

  const confirm = async () => {
    if (!quote || !requirement) return;
    if (!instalmentValid) { toast.error(`Instalments must total ${formatINR(total)}`); return; }
    if (paymentType === "cheque" && (!chequeNumber.trim() || !chequeBank.trim())) {
      toast.error("Cheque number and bank are required"); return;
    }
    setSubmitting(true);
    try {
      // Compute booking financials
      let amountPaid = 0;
      let status: Database["public"]["Enums"]["booking_status"] = "confirmed";
      if (paymentType === "full" || paymentType === "cash") amountPaid = total;
      else if (paymentType === "advance_50") amountPaid = advanceAmount;
      else if (paymentType === "cheque") { amountPaid = 0; status = "cheque_pending"; }
      else if (paymentType === "b2b_credit" || paymentType === "instalment") amountPaid = 0;
      const balanceDue = Math.max(0, total - amountPaid);

      // 1. Create booking
      const { data: booking, error: bErr } = await supabase.from("bookings").insert({
        lead_id: quote.lead_id,
        requirement_id: quote.requirement_id,
        quotation_id: quote.id,
        company_id: quote.company_id,
        status,
        event_date: requirement.event_date!,
        start_time: requirement.start_time,
        end_time: requirement.end_time,
        venue: venue || null,
        total_amount: total,
        amount_paid: amountPaid,
        balance_due: balanceDue,
        payment_type: paymentType,
        cheque_number: paymentType === "cheque" ? chequeNumber : null,
        cheque_bank: paymentType === "cheque" ? chequeBank : null,
        cheque_clear_date: paymentType === "cheque" && chequeClearDate ? chequeClearDate : null,
        created_by: profile?.id ?? null,
      }).select("*").single();
      if (bErr || !booking) throw new Error(bErr?.message || "Couldn't create booking");

      // 2. Create payment rows
      const paymentRows: Database["public"]["Tables"]["payments"]["Insert"][] = [];
      const today = new Date().toISOString().slice(0, 10);
      if (paymentType === "full" || paymentType === "cash") {
        paymentRows.push({
          booking_id: booking.id, lead_id: quote.lead_id, company_id: quote.company_id,
          type: paymentType, amount: total, status: "received", received_at: new Date().toISOString(),
          transaction_reference: transactionRef || null, created_by: profile?.id ?? null,
        });
      } else if (paymentType === "advance_50") {
        paymentRows.push({
          booking_id: booking.id, lead_id: quote.lead_id, company_id: quote.company_id,
          type: "advance_50", amount: advanceAmount, status: "received", received_at: new Date().toISOString(),
          transaction_reference: transactionRef || null, created_by: profile?.id ?? null,
        });
        if (balanceDue > 0) {
          paymentRows.push({
            booking_id: booking.id, lead_id: quote.lead_id, company_id: quote.company_id,
            type: "advance_50", amount: balanceDue, status: "pending",
            due_date: requirement.event_date, created_by: profile?.id ?? null,
            notes: "Balance due before event",
          });
        }
      } else if (paymentType === "cheque") {
        paymentRows.push({
          booking_id: booking.id, lead_id: quote.lead_id, company_id: quote.company_id,
          type: "cheque", amount: total, status: "pending",
          cheque_number: chequeNumber, cheque_bank: chequeBank,
          cheque_clear_date: chequeClearDate || null,
          due_date: chequeClearDate || null,
          created_by: profile?.id ?? null,
        });
      } else if (paymentType === "instalment") {
        instalments.forEach((it, idx) => {
          paymentRows.push({
            booking_id: booking.id, lead_id: quote.lead_id, company_id: quote.company_id,
            type: "instalment", amount: it.amount, status: "pending",
            due_date: it.due_date, instalment_number: idx + 1, total_instalments: instalments.length,
            created_by: profile?.id ?? null,
          });
        });
      } else if (paymentType === "b2b_credit") {
        paymentRows.push({
          booking_id: booking.id, lead_id: quote.lead_id, company_id: quote.company_id,
          type: "b2b_credit", amount: total, status: "pending",
          due_date: requirement.event_date, created_by: profile?.id ?? null,
          notes: "B2B credit terms",
        });
      }
      if (paymentRows.length) {
        const { error: pErr } = await supabase.from("payments").insert(paymentRows);
        if (pErr) throw new Error(pErr.message);
      }

      // 3. Auto-generate payment reminders for upcoming dues (25%, 50%, 75%, 100% of time elapsed)
      const dueRows = paymentRows.filter((p) => p.status === "pending" && p.due_date);
      if (dueRows.length) {
        const now = Date.now();
        const reminders: Database["public"]["Tables"]["payment_reminders"]["Insert"][] = [];
        dueRows.forEach((p) => {
          const due = new Date(p.due_date as string).getTime();
          if (due <= now) return;
          [25, 50, 75, 100].forEach((pct) => {
            const at = now + ((due - now) * pct) / 100;
            reminders.push({
              booking_id: booking.id, lead_id: quote.lead_id, company_id: quote.company_id,
              scheduled_at: new Date(at).toISOString(), trigger_percent: pct,
              message_template: company?.wa_template_payment_reminder ?? null,
            });
          });
        });
        if (reminders.length) await supabase.from("payment_reminders").insert(reminders);
      }

      // 4. Confirm the slot (find slot held by this requirement)
      await supabase.from("slots").update({
        status: "confirmed",
        confirmed_by_booking_id: booking.id,
        held_until: null,
      }).eq("held_by_requirement_id", quote.requirement_id);

      // 5. Lock the lead
      await supabase.from("leads").update({ status: "locked" }).eq("id", quote.lead_id);

      // 6. Activity log
      await supabase.from("activity_logs").insert({
        lead_id: quote.lead_id,
        action: `Booking confirmed · ${formatINR(total)} · ${PAYMENT_OPTIONS.find((p) => p.value === paymentType)?.label}`,
        note: notes || null,
        action_type: "status_change", performed_by: profile?.id ?? null,
        metadata: { booking_id: booking.id, quotation_id: quote.id, amount_paid: amountPaid },
      });

      toast.success("Booking confirmed!");
      onConfirmed?.(booking.id);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't confirm booking");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Confirm booking
          </DialogTitle>
        </DialogHeader>

        {loading || !quote || !requirement ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Event summary */}
            <div className="bg-muted/40 border rounded-md p-3 text-sm space-y-1">
              <div className="font-medium">{requirement.event_type || "Event"}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {requirement.event_date ? formatDateIN(requirement.event_date) : "Date TBD"}
                {requirement.start_time && ` · ${formatTimeOfDay(requirement.start_time)}`}
                {requirement.end_time && ` – ${formatTimeOfDay(requirement.end_time)}`}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="font-semibold">{formatINR(total)}</span>
              </div>
            </div>

            {/* Venue */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Venue (optional)</Label>
              <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Sri Krishna Mandapam, T Nagar" />
            </div>

            {/* Payment type */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Payment</Label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPaymentType(opt.value)}
                    className={`text-left border rounded-md p-2.5 transition-colors ${paymentType === opt.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
                  >
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{opt.help}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Per-type details */}
            {paymentType === "advance_50" && (
              <div className="space-y-2 border rounded-md p-3 bg-card">
                <Label className="text-xs">Advance amount received now</Label>
                <div className="relative">
                  <IndianRupee className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input type="number" min={0} max={total} value={advanceAmount} onChange={(e) => setAdvanceAmount(Number(e.target.value))} className="pl-7" />
                </div>
                <div className="text-xs text-muted-foreground">Balance {formatINR(Math.max(0, total - advanceAmount))} due before event.</div>
                <Input value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} placeholder="UPI / transaction reference (optional)" />
              </div>
            )}

            {(paymentType === "full" || paymentType === "cash") && (
              <div className="space-y-2 border rounded-md p-3 bg-card">
                <div className="text-sm">Receiving {formatINR(total)} {paymentType === "cash" ? "in cash" : "now"}.</div>
                {paymentType === "full" && (
                  <Input value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} placeholder="UPI / transaction reference (optional)" />
                )}
              </div>
            )}

            {paymentType === "cheque" && (
              <div className="space-y-2 border rounded-md p-3 bg-card">
                <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded p-2">
                  Booking will be marked provisional until the cheque clears.
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} placeholder="Cheque number *" />
                  <Input value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} placeholder="Bank *" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Expected clearing date</Label>
                  <Input type="date" value={chequeClearDate} onChange={(e) => setChequeClearDate(e.target.value)} />
                </div>
              </div>
            )}

            {paymentType === "instalment" && (
              <div className="space-y-2 border rounded-md p-3 bg-card">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Instalment plan</Label>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setInstalments([...instalments, { amount: 0, due_date: new Date().toISOString().slice(0, 10) }])}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                {instalments.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <Input type="number" min={0} value={it.amount} onChange={(e) => setInstalments(instalments.map((x, i) => i === idx ? { ...x, amount: Number(e.target.value) } : x))} placeholder="Amount" />
                    <Input type="date" value={it.due_date} onChange={(e) => setInstalments(instalments.map((x, i) => i === idx ? { ...x, due_date: e.target.value } : x))} />
                    <Button type="button" size="icon" variant="ghost" onClick={() => setInstalments(instalments.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <div className={`text-xs ${instalmentValid ? "text-muted-foreground" : "text-rose-600"}`}>
                  Sum: {formatINR(instalmentSum)} / {formatINR(total)}
                  {!instalmentValid && ` (off by ${formatINR(Math.abs(instalmentSum - total))})`}
                </div>
              </div>
            )}

            {paymentType === "b2b_credit" && (
              <div className="space-y-2 border rounded-md p-3 bg-card text-sm text-muted-foreground">
                No advance taken. Invoice will be due on event date.
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Internal notes (optional)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember about this booking…" />
            </div>
          </div>
        )}

        <DialogFooter className="border-t p-3 gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={confirm} disabled={submitting || loading || !quote}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
            Confirm booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
