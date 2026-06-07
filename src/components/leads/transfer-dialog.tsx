import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  fromCompanyId: string;
  performedBy: string | null;
  onDone?: () => void;
}

const CHECKS = [
  "Client has been informed about the transfer",
  "No quotation or payment has been issued by us",
  "Lead's requirement is genuinely better suited elsewhere",
  "I understand this lead will be locked until approved",
];

export function TransferDialog({ open, onOpenChange, leadId, fromCompanyId, performedBy, onDone }: Props) {
  const { companies } = useAuth();
  const [step, setStep] = useState(1);
  const [checked, setChecked] = useState<boolean[]>([false, false, false, false]);
  const [reason, setReason] = useState("");
  const [toCompanyId, setToCompanyId] = useState<string>("");
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setChecked([false, false, false, false]);
      setReason("");
      setToCompanyId("");
      setSummary("");
    }
  }, [open]);

  const targets = companies.filter((c) => c.id !== fromCompanyId);
  const allChecked = checked.every(Boolean);
  const reasonOk = reason.trim().length >= 20;
  const step3Ok = toCompanyId && summary.trim().length >= 20;

  const submit = async () => {
    if (!toCompanyId || !performedBy) return;
    setSubmitting(true);

    // Check if any active admin at target company has auto-approve on
    const { data: targetAdmins } = await supabase
      .from("profiles")
      .select("id,auto_approve_transfers,is_active")
      .eq("company_id", toCompanyId)
      .eq("is_active", true)
      .eq("auto_approve_transfers", true)
      .limit(1);
    const autoApprove = (targetAdmins?.length ?? 0) > 0;

    const status = autoApprove ? "auto_approved" : "pending";

    const { data: tr, error } = await supabase.from("transfer_requests").insert({
      lead_id: leadId,
      from_company_id: fromCompanyId,
      to_company_id: toCompanyId,
      requested_by: performedBy,
      reason: reason.trim(),
      requirement_summary: summary.trim(),
      status,
      reviewed_by: autoApprove ? performedBy : null,
    }).select("id").maybeSingle();

    if (error || !tr) {
      setSubmitting(false);
      toast.error(error?.message ?? "Failed to create transfer");
      return;
    }

    if (autoApprove) {
      // Execute transfer immediately
      await supabase.from("leads").update({
        company_id: toCompanyId,
        assigned_to: null,
        status: "new",
      }).eq("id", leadId);
    } else {
      // Lock lead until decision
      await supabase.from("leads").update({ status: "locked" }).eq("id", leadId);
    }

    await supabase.from("activity_logs").insert({
      lead_id: leadId,
      action: autoApprove ? "Transfer auto-approved" : "Transfer requested",
      note: `To: ${companies.find((c) => c.id === toCompanyId)?.name}\nReason: ${reason.trim()}`,
      action_type: "transfer",
      performed_by: performedBy,
    });

    // Notify admins at the target company AND all super admins (for review)
    const [{ data: notifyTargets }, { data: saRoles }] = await Promise.all([
      supabase.from("profiles").select("id").eq("company_id", toCompanyId).eq("is_active", true),
      autoApprove
        ? Promise.resolve({ data: [] as { user_id: string }[] })
        : supabase.from("user_roles").select("user_id").eq("role", "super_admin"),
    ]);
    const recipientIds = new Set<string>();
    (notifyTargets ?? []).forEach((p) => recipientIds.add(p.id));
    (saRoles ?? []).forEach((r: any) => recipientIds.add(r.user_id));
    recipientIds.delete(performedBy);
    if (recipientIds.size > 0) {
      await supabase.from("notifications").insert(
        [...recipientIds].map((uid) => ({
          user_id: uid,
          lead_id: leadId,
          type: "transfer" as const,
          title: autoApprove ? "Lead transferred to your company" : "New transfer request",
          body: autoApprove
            ? `A lead has been auto-approved and added to your company.`
            : `A lead transfer is pending review.`,
        })),
      );
    }

    setSubmitting(false);
    toast.success(autoApprove ? "Transfer completed" : "Transfer request submitted");
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer lead · Step {step} of 3</DialogTitle>
          <DialogDescription>
            {step === 1 && "Confirm a few things before transferring."}
            {step === 2 && "Why is this lead being transferred?"}
            {step === 3 && "Pick the receiving company and share the requirement."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <div className="bg-warning/10 border border-warning/30 text-warning dark:text-warning rounded-md p-3 flex gap-2 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>This lead will be locked from edits until the request is approved or rejected.</span>
            </div>
            {CHECKS.map((c, i) => (
              <label key={i} className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={checked[i]}
                  onCheckedChange={(v) => setChecked((arr) => arr.map((x, idx) => (idx === i ? !!v : x)))}
                  className="mt-0.5"
                />
                <span className="text-sm">{c}</span>
              </label>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <Label>Reason (minimum 20 characters)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Explain why this transfer is necessary…"
            />
            <div className="text-[11px] text-muted-foreground">{reason.trim().length} / 20</div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Transfer to</Label>
              <Select value={toCompanyId} onValueChange={setToCompanyId}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select company…" /></SelectTrigger>
                <SelectContent>
                  {targets.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Requirement summary (minimum 20 characters)</Label>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={4}
                placeholder="Event type, date, guest count, budget, special requests…"
              />
              <div className="text-[11px] text-muted-foreground">{summary.trim().length} / 20</div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={submitting} className="min-h-11">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-11">Cancel</Button>
          )}
          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={(step === 1 && !allChecked) || (step === 2 && !reasonOk)}
              className="min-h-11"
            >
              Next <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={!step3Ok || submitting} className="min-h-11">
              {submitting ? "Submitting…" : "Submit transfer"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
