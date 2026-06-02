import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  performedBy: string | null;
  alreadyFlagged: boolean;
  currentReason: string | null;
  onDone: () => void;
}

export function BlacklistDialog({ open, onOpenChange, leadId, performedBy, alreadyFlagged, currentReason, onDone }: Props) {
  const [reason, setReason] = useState(currentReason ?? "");
  const [saving, setSaving] = useState(false);

  const apply = async (flag: boolean) => {
    if (flag && !reason.trim()) { toast.error("Please add a reason"); return; }
    setSaving(true);
    const { error } = await supabase.from("leads").update({
      is_blacklisted: flag,
      blacklist_reason: flag ? reason.trim() : null,
      status: flag ? "locked" : "in_progress",
    }).eq("id", leadId);
    if (!error) {
      await supabase.from("activity_logs").insert({
        lead_id: leadId,
        action: flag ? "Lead flagged (do not contact)" : "Flag removed from lead",
        action_type: "status_change",
        note: flag ? reason.trim() : null,
        performed_by: performedBy,
      });
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(flag ? "Lead flagged" : "Flag removed");
    onDone();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{alreadyFlagged ? "Remove flag" : "Flag this lead"}</DialogTitle>
          <DialogDescription>
            {alreadyFlagged
              ? "This will allow your team to contact this person again."
              : "Flagging stops future contact and shows a warning to everyone across all companies."}
          </DialogDescription>
        </DialogHeader>

        {!alreadyFlagged && (
          <div className="space-y-1.5">
            <Label htmlFor="bl-reason">Why are you flagging?</Label>
            <Textarea id="bl-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. rude behaviour, spam, asked not to call" />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={alreadyFlagged ? "default" : "destructive"}
            onClick={() => apply(!alreadyFlagged)}
            disabled={saving}
          >
            {saving ? "Saving…" : alreadyFlagged ? "Remove flag" : "Flag lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
