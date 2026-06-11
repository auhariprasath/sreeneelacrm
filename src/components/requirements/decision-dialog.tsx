import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CheckCircle2, ThumbsDown, Clock, FileCheck2 } from "lucide-react";
import { DateTimeField } from "@/components/ui/datetime-field";


type Decision = "interested" | "not_interested" | "needs_time" | "confirm_booking";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  companyId: string;
  requirementId: string;
  onDone?: () => void;
}

const OPTIONS: { value: Decision; label: string; desc: string; icon: any; tone: string }[] = [
  { value: "interested", label: "Interested — send proposal", desc: "Marks the lead positive and logs the next step.", icon: FileCheck2, tone: "text-success" },
  { value: "confirm_booking", label: "Ready to confirm booking", desc: "Locks the slot as confirmed and moves to bookings.", icon: CheckCircle2, tone: "text-primary" },
  { value: "needs_time", label: "Needs more time", desc: "Schedules a follow-up and keeps the requirement open.", icon: Clock, tone: "text-warning" },
  { value: "not_interested", label: "Not interested — drop", desc: "Captures the reason and releases any held slot.", icon: ThumbsDown, tone: "text-destructive" },
];

export function DecisionDialog({ open, onOpenChange, leadId, companyId, requirementId, onDone }: Props) {
  const { profile } = useAuth();
  const [decision, setDecision] = useState<Decision>("interested");
  const [note, setNote] = useState("");
  const [dropReason, setDropReason] = useState("");
  const [dropReasons, setDropReasons] = useState<string[]>([]);
  const [followUpAt, setFollowUpAt] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [amountValue, setAmountValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDecision("interested");
    setNote(""); setDropReason(""); setFollowUpAt("");
    setCompetitor(""); setAmountValue("");
    supabase.from("companies").select("drop_reasons").eq("id", companyId).maybeSingle()
      .then(({ data }) => {
        const list = (data as any)?.drop_reasons;
        const arr = Array.isArray(list)
          ? list.map((x: any) => (typeof x === "string" ? x : x?.name)).filter(Boolean)
          : [];
        setDropReasons(arr);
      });
    // Prefill amount from latest agreed/sent quotation
    supabase.from("quotations").select("total").eq("requirement_id", requirementId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (data?.total != null) setAmountValue(String(data.total)); });
  }, [open, companyId, requirementId]);

  const submit = async () => {
    if (decision === "not_interested" && !dropReason) {
      toast.error("Pick a drop reason");
      return;
    }
    if (decision === "needs_time" && !followUpAt) {
      toast.error("Pick a follow-up date & time");
      return;
    }
    setSaving(true);
    try {
      const performed_by = profile?.id ?? null;
      const meta: Record<string, any> = { decision, requirement_id: requirementId };

      if (decision === "interested") {
        await supabase.from("leads").update({ status: "positive" }).eq("id", leadId);
        await supabase.from("requirements").update({ status: "complete" }).eq("id", requirementId);
      } else if (decision === "confirm_booking") {
        // Slot only locks when the booking is created/confirmed after payment.
        // Here we just advance the requirement and lead status.
        await supabase.from("requirements").update({ status: "slot_confirmed" }).eq("id", requirementId);
        await supabase.from("leads").update({ status: "positive" }).eq("id", leadId);
        // Log WON
        const amt = Number(amountValue || 0);
        await supabase.from("win_loss_log").insert({
          company_id: companyId, lead_id: leadId, outcome: "won",
          amount_value: isNaN(amt) ? null : amt,
          closed_by: performed_by, closed_at: new Date().toISOString(),
        });
      } else if (decision === "needs_time") {
        const { closeOtherActiveReminders } = await import("@/lib/lead-reminders");
        await closeOtherActiveReminders(leadId);
        await supabase.from("follow_ups").insert({
          lead_id: leadId, scheduled_at: new Date(followUpAt).toISOString(),
          note: note || "Decision pending", type: "custom", created_by: performed_by,
        });
        // Only move a brand-new lead into "in_progress"; preserve any meaningful
        // status already set by a prior call outcome / decision.
        const { data: cur } = await supabase.from("leads").select("status").eq("id", leadId).maybeSingle();
        if (cur?.status === "new") {
          await supabase.from("leads").update({ status: "in_progress" }).eq("id", leadId);
        }
      } else if (decision === "not_interested") {
        await supabase.from("requirements").update({ status: "complete" }).eq("id", requirementId);
        await supabase.from("leads").update({
          status: "negative",
          notes: note ? `Dropped (${dropReason}): ${note}` : `Dropped: ${dropReason}`,
        }).eq("id", leadId);
        meta.drop_reason = dropReason;
        if (competitor) meta.competitor = competitor;
        const amt = Number(amountValue || 0);
        await supabase.from("win_loss_log").insert({
          company_id: companyId, lead_id: leadId, outcome: "lost",
          drop_reason: dropReason, competitor_name: competitor || null,
          amount_value: isNaN(amt) || amt === 0 ? null : amt,
          closed_by: performed_by, closed_at: new Date().toISOString(),
        });
      }

      await supabase.from("activity_logs").insert({
        lead_id: leadId,
        action: labelFor(decision),
        note: note || (decision === "not_interested" ? dropReason : null),
        action_type: "status_change",
        performed_by,
        metadata: meta,
      });

      toast.success("Decision recorded");
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't save decision");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record lead response</DialogTitle>
          <DialogDescription>What did the customer say about this requirement?</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {OPTIONS.map((o) => {
            const Icon = o.icon;
            const active = decision === o.value;
            return (
              <button
                key={o.value}
                onClick={() => setDecision(o.value)}
                className={`w-full text-left rounded-md border p-3 flex items-start gap-3 transition-colors ${active ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}
              >
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${o.tone}`} />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{o.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{o.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {decision === "not_interested" && (
          <>
            <div className="space-y-1.5">
              <Label>Drop reason *</Label>
              <Select value={dropReason} onValueChange={setDropReason}>
                <SelectTrigger><SelectValue placeholder="Pick a reason" /></SelectTrigger>
                <SelectContent>
                  {dropReasons.length === 0 && (
                    <SelectItem value="__none" disabled>No reasons configured — add them in Settings</SelectItem>
                  )}
                  {dropReasons.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Competitor (optional)</Label>
                <Input value={competitor} onChange={(e) => setCompetitor(e.target.value)} placeholder="e.g. Pixel Studio" />
              </div>
              <div className="space-y-1.5">
                <Label>Lost value (₹, optional)</Label>
                <Input type="number" min="0" value={amountValue} onChange={(e) => setAmountValue(e.target.value)} placeholder="0" />
              </div>
            </div>
          </>
        )}

        {decision === "confirm_booking" && (
          <div className="space-y-1.5">
            <Label>Won value (₹)</Label>
            <Input type="number" min="0" value={amountValue} onChange={(e) => setAmountValue(e.target.value)} placeholder="Auto-filled from quotation" />
          </div>
        )}

        {decision === "needs_time" && (
          <div className="space-y-1.5">
            <Label>Follow-up at *</Label>
            <DateTimeField value={followUpAt} onChange={setFollowUpAt} />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Notes (optional)</Label>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to remember about this conversation" />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save decision"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function labelFor(d: Decision): string {
  switch (d) {
    case "interested": return "Lead interested — proposal stage";
    case "confirm_booking": return "Booking confirmed";
    case "needs_time": return "Lead needs more time";
    case "not_interested": return "Lead dropped";
  }
}
