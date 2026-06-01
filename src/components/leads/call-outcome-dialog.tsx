import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, PhoneOff, Clock, ShieldX, ThumbsDown } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["lead_status"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  currentFollowUpCount: number;
  maxFollowUpAttempts: number;
  performedBy: string | null;
  onScheduleFollowUp: () => void;
  onChanged?: () => void;
}

interface Outcome {
  key: string;
  label: string;
  icon: any;
  status?: Status;
  promptFollowUp?: boolean;
  className: string;
}

const OUTCOMES: Outcome[] = [
  { key: "interested", label: "Interested",       icon: CheckCircle2, status: "positive",     className: "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30" },
  { key: "neutral",    label: "Neutral / Thinking", icon: Clock,      status: "neutral",      className: "bg-muted hover:bg-muted/70 border-border" },
  { key: "not_interested", label: "Not interested", icon: ThumbsDown, status: "negative",     className: "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30" },
  { key: "no_answer",  label: "No answer",         icon: PhoneOff,    promptFollowUp: true,   className: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30" },
  { key: "wrong_number", label: "Wrong number",    icon: ShieldX,     status: "closed",       className: "bg-zinc-500/10 hover:bg-zinc-500/20 border-zinc-500/30" },
];

export function CallOutcomeDialog({
  open, onOpenChange, leadId, currentFollowUpCount, maxFollowUpAttempts, performedBy, onScheduleFollowUp, onChanged,
}: Props) {
  const [selected, setSelected] = useState<Outcome | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setSelected(null); setNote(""); };

  const save = async () => {
    if (!selected) return;
    setSaving(true);

    // Log the call outcome
    await supabase.from("activity_logs").insert({
      lead_id: leadId,
      action: `Call outcome: ${selected.label}`,
      action_type: "call",
      note: note.trim() || null,
      performed_by: performedBy,
    });

    // Handle no-answer: increment follow_up_count, auto-unresponsive if exceeded
    if (selected.key === "no_answer") {
      const next = currentFollowUpCount + 1;
      const autoUnresponsive = next >= maxFollowUpAttempts;
      const updates: Record<string, unknown> = { follow_up_count: next };
      if (autoUnresponsive) updates.status = "unresponsive";
      await supabase.from("leads").update(updates).eq("id", leadId);
      if (autoUnresponsive) {
        await supabase.from("activity_logs").insert({
          lead_id: leadId, action: `Auto-tagged as Unresponsive (${next}/${maxFollowUpAttempts} attempts)`,
          action_type: "status_change", performed_by: performedBy,
        });
        toast.info("Lead auto-tagged as Unresponsive");
      }
    } else if (selected.status) {
      await supabase.from("leads").update({ status: selected.status }).eq("id", leadId);
      await supabase.from("activity_logs").insert({
        lead_id: leadId, action: `Status set to ${selected.status}`,
        action_type: "status_change", performed_by: performedBy,
      });
    }

    setSaving(false);
    toast.success("Call logged");
    onChanged?.();

    if (selected.promptFollowUp) {
      // close and open follow-up
      reset();
      onOpenChange(false);
      onScheduleFollowUp();
    } else {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Call outcome</DialogTitle>
          <DialogDescription>How did the call go? This logs to the lead's activity.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2">
          {OUTCOMES.map((o) => {
            const Icon = o.icon;
            const active = selected?.key === o.key;
            return (
              <button
                key={o.key}
                onClick={() => setSelected(o)}
                className={`flex items-center gap-3 border rounded-md p-3 min-h-[44px] text-left text-sm transition-colors ${o.className} ${active ? "ring-2 ring-primary" : ""}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="font-medium">{o.label}</span>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="space-y-1.5">
            <Label htmlFor="co-note">Note (optional)</Label>
            <Textarea id="co-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was discussed?" />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!selected || saving}>{saving ? "Saving…" : "Log call"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
