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
  alreadyBlacklisted: boolean;
  currentReason: string | null;
  onDone: () => void;
}

export function BlacklistDialog({ open, onOpenChange, leadId, performedBy, alreadyBlacklisted, currentReason, onDone }: Props) {
  const [reason, setReason] = useState(currentReason ?? "");
  const [saving, setSaving] = useState(false);

  const apply = async (blacklist: boolean) => {
    if (blacklist && !reason.trim()) { toast.error("Reason required"); return; }
    setSaving(true);
    const { error } = await supabase.from("leads").update({
      is_blacklisted: blacklist,
      blacklist_reason: blacklist ? reason.trim() : null,
      status: blacklist ? "locked" : "in_progress",
    }).eq("id", leadId);
    if (!error) {
      await supabase.from("activity_logs").insert({
        lead_id: leadId,
        action: blacklist ? "Lead blacklisted" : "Lead removed from blacklist",
        action_type: "status_change",
        note: blacklist ? reason.trim() : null,
        performed_by: performedBy,
      });
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(blacklist ? "Blacklisted" : "Removed from blacklist");
    onDone();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{alreadyBlacklisted ? "Remove from blacklist" : "Blacklist lead"}</DialogTitle>
          <DialogDescription>
            {alreadyBlacklisted
              ? "Confirm you want to unblock this contact across the system."
              : "Blacklisting prevents future contact and shows a warning across all companies."}
          </DialogDescription>
        </DialogHeader>

        {!alreadyBlacklisted && (
          <div className="space-y-1.5">
            <Label htmlFor="bl-reason">Reason</Label>
            <Textarea id="bl-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. abusive, spam, do-not-call request" />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={alreadyBlacklisted ? "default" : "destructive"}
            onClick={() => apply(!alreadyBlacklisted)}
            disabled={saving}
          >
            {saving ? "Saving…" : alreadyBlacklisted ? "Remove" : "Blacklist"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
