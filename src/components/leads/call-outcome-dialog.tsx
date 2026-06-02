import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Building2, PhoneCall, Edit3, XCircle, Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["lead_status"];

type Outcome = "interested" | "meeting_scheduled" | "callback_requested" | "other" | "not_interested";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  companyId: string;
  performedBy: string | null;
  /** Open intake/quotation flow */
  onInterested: () => void;
  /** Open follow-up scheduler */
  onScheduleFollowUp: () => void;
  /** Open venue meeting scheduler */
  onScheduleMeeting: () => void;
  onChanged?: () => void;
}

const OUTCOMES: { key: Outcome; label: string; sub: string; icon: any; cls: string }[] = [
  { key: "interested",          label: "Interested",          sub: "Lead wants to proceed",                icon: CheckCircle2, cls: "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20" },
  { key: "meeting_scheduled",   label: "Meeting at venue",    sub: "Client wants to visit before deciding",icon: Building2,   cls: "bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20" },
  { key: "callback_requested",  label: "Callback requested",  sub: "They asked me to call back",           icon: PhoneCall,   cls: "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20" },
  { key: "other",               label: "Other",               sub: "Something else happened",              icon: Edit3,       cls: "bg-muted border-border hover:bg-muted/70" },
  { key: "not_interested",      label: "Not interested",      sub: "Lead declined",                         icon: XCircle,     cls: "bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20" },
];

export function CallOutcomeDialog({
  open, onOpenChange, leadId, companyId, performedBy,
  onInterested, onScheduleFollowUp, onScheduleMeeting, onChanged,
}: Props & { currentFollowUpCount?: number; maxFollowUpAttempts?: number }) {
  const [selected, setSelected] = useState<Outcome | null>(null);
  const [otherNote, setOtherNote] = useState("");
  const [otherNext, setOtherNext] = useState<"follow_up" | "meeting" | "none" | "">("");
  const [dropReason, setDropReason] = useState("");
  const [dropReasonsList, setDropReasonsList] = useState<string[]>([]);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leadName, setLeadName] = useState("there");

  useEffect(() => {
    if (!open) {
      setSelected(null); setOtherNote(""); setOtherNext(""); setDropReason("");
      setConfirmingClose(false); setSaving(false);
      return;
    }
    (async () => {
      const [{ data: l }, { data: c }] = await Promise.all([
        supabase.from("leads").select("full_name").eq("id", leadId).maybeSingle(),
        supabase.from("companies").select("drop_reasons").eq("id", companyId).maybeSingle(),
      ]);
      setLeadName((l as any)?.full_name ?? "this lead");
      const list = (Array.isArray((c as any)?.drop_reasons) ? (c as any).drop_reasons : []) as any[];
      setDropReasonsList(list.map((x: any) => typeof x === "string" ? x : (x?.label ?? "")).filter(Boolean));
    })();
  }, [open, leadId, companyId]);

  const logOutcome = async (outcome: Outcome, extras: Record<string, any> = {}) => {
    await supabase.from("call_outcomes" as any).insert({
      lead_id: leadId,
      company_id: companyId,
      outcome,
      notes: extras.notes ?? null,
      next_action: extras.next_action ?? null,
      drop_reason: extras.drop_reason ?? null,
      performed_by: performedBy,
    } as any);
  };

  const handleInterested = async () => {
    setSaving(true);
    await logOutcome("interested");
    await supabase.from("leads").update({ status: "positive" as Status }).eq("id", leadId);
    await supabase.from("activity_logs").insert({
      lead_id: leadId, action: "Call outcome: Interested. Moving to next step.",
      action_type: "call", performed_by: performedBy,
    });
    setSaving(false);
    toast.success("Outcome logged ✓");
    onChanged?.();
    onOpenChange(false);
    onInterested();
  };

  const handleMeeting = async () => {
    setSaving(true);
    await logOutcome("meeting_scheduled");
    await supabase.from("leads").update({ status: "in_progress" as Status }).eq("id", leadId);
    await supabase.from("activity_logs").insert({
      lead_id: leadId, action: "Call outcome: Meeting at venue.",
      action_type: "call", performed_by: performedBy,
    });
    setSaving(false);
    onChanged?.();
    onOpenChange(false);
    onScheduleMeeting();
  };

  const handleCallback = async () => {
    setSaving(true);
    await logOutcome("callback_requested");
    await supabase.from("activity_logs").insert({
      lead_id: leadId, action: "Call outcome: Callback requested.",
      action_type: "call", performed_by: performedBy,
    });
    setSaving(false);
    onChanged?.();
    onOpenChange(false);
    onScheduleFollowUp();
  };

  const handleOther = async () => {
    if (!otherNote.trim()) { toast.error("Please add a note"); return; }
    if (!otherNext) { toast.error("Please select the next step"); return; }
    setSaving(true);
    await logOutcome("other", { notes: otherNote.trim(), next_action: otherNext });
    await supabase.from("activity_logs").insert({
      lead_id: leadId, action: `Call outcome: Other — ${otherNote.trim()}. Next: ${otherNext}`,
      action_type: "call", note: otherNote.trim(), performed_by: performedBy,
    });
    setSaving(false);
    onChanged?.();
    onOpenChange(false);
    if (otherNext === "follow_up") onScheduleFollowUp();
    else if (otherNext === "meeting") onScheduleMeeting();
  };

  const handleNotInterestedConfirm = async () => {
    if (!dropReason.trim()) { toast.error("Drop reason is required"); return; }
    if (!confirmingClose) { setConfirmingClose(true); return; }
    setSaving(true);
    await logOutcome("not_interested", { drop_reason: dropReason });
    await supabase.from("leads").update({ status: "closed" as Status }).eq("id", leadId);
    await supabase.from("win_loss_log").insert({
      lead_id: leadId, company_id: companyId, outcome: "lost",
      drop_reason: dropReason, closed_by: performedBy,
    });
    await supabase.from("activity_logs").insert({
      lead_id: leadId, action: `Call outcome: Not interested. Reason: ${dropReason}. Lead closed.`,
      action_type: "status_change", performed_by: performedBy,
    });
    // Schedule 30-day re-engagement
    const at = new Date(Date.now() + 30 * 86400_000).toISOString();
    await supabase.from("follow_ups").insert({
      lead_id: leadId,
      scheduled_at: at,
      type: "custom" as any,
      note: "30-day re-engagement (auto): one more chance WA after declined.",
      created_by: performedBy,
    });
    setSaving(false);
    toast.success("Lead closed · 30-day re-engagement scheduled");
    onChanged?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>How did the call go with {leadName}?</DialogTitle>
          <DialogDescription>This logs the outcome and triggers the next step.</DialogDescription>
        </DialogHeader>

        {!selected ? (
          <div className="grid grid-cols-1 gap-2">
            {OUTCOMES.map((o) => {
              const Icon = o.icon;
              return (
                <button
                  key={o.key}
                  onClick={() => setSelected(o.key)}
                  className={`flex items-start gap-3 border rounded-md p-3 min-h-[64px] text-left text-sm transition ${o.cls}`}
                >
                  <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold">{o.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{o.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : selected === "other" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Notes (required)</Label>
              <Textarea rows={3} value={otherNote} onChange={(e) => setOtherNote(e.target.value)} placeholder="What happened?" />
            </div>
            <div className="space-y-1.5">
              <Label>Next step (required)</Label>
              <Select value={otherNext} onValueChange={(v) => setOtherNext(v as any)}>
                <SelectTrigger><SelectValue placeholder="Pick next action" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="follow_up">Schedule follow-up</SelectItem>
                  <SelectItem value="meeting">Schedule venue meeting</SelectItem>
                  <SelectItem value="none">No action needed (lead will call back)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setSelected(null)}>Back</Button>
              <Button onClick={handleOther} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
            </DialogFooter>
          </div>
        ) : selected === "not_interested" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Drop reason</Label>
              <Select value={dropReason} onValueChange={setDropReason}>
                <SelectTrigger><SelectValue placeholder="Choose a reason" /></SelectTrigger>
                <SelectContent>
                  {dropReasonsList.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              {dropReason === "Other" && (
                <Textarea rows={2} placeholder="Specify" onChange={(e) => setDropReason(e.target.value)} />
              )}
            </div>
            {confirmingClose && (
              <div className="text-sm bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-md p-3">
                Are you sure? <strong>{leadName}</strong> will be marked as closed. A 30-day re-engagement WhatsApp will be auto-scheduled.
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setSelected(null); setConfirmingClose(false); }}>Go back</Button>
              <Button variant="destructive" onClick={handleNotInterestedConfirm} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmingClose ? "Yes, close lead" : "Continue"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Proceeding with: <strong>{OUTCOMES.find((o) => o.key === selected)?.label}</strong></div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setSelected(null)}>Back</Button>
              <Button
                onClick={selected === "interested" ? handleInterested : selected === "meeting_scheduled" ? handleMeeting : handleCallback}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
