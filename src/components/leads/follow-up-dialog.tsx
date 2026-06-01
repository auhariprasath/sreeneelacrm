import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  performedBy: string | null;
  defaultMinutesFromNow?: number;
}

const PRESETS = [
  { label: "In 1 hour",  mins: 60 },
  { label: "In 3 hours", mins: 180 },
  { label: "Tomorrow 10 AM", mins: -1, kind: "tomorrow_10" as const },
  { label: "In 2 days",  mins: 60 * 24 * 2 },
];

function isoLocalIn(minsFromNow: number) {
  const d = new Date(Date.now() + minsFromNow * 60_000);
  d.setSeconds(0, 0);
  // yyyy-MM-ddTHH:mm in local time
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function tomorrow10AM() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FollowUpDialog({ open, onOpenChange, leadId, performedBy, defaultMinutesFromNow = 60 }: Props) {
  const [when, setWhen] = useState<string>(() => isoLocalIn(defaultMinutesFromNow));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!when) { toast.error("Pick a date/time"); return; }
    const scheduled = new Date(when);
    if (isNaN(scheduled.getTime())) { toast.error("Invalid date/time"); return; }
    if (scheduled.getTime() < Date.now() - 60_000) { toast.error("Pick a time in the future"); return; }

    setSaving(true);
    const { error } = await supabase.from("follow_ups").insert({
      lead_id: leadId,
      scheduled_at: scheduled.toISOString(),
      note: note.trim() || null,
      created_by: performedBy,
    });
    if (!error) {
      await supabase.from("activity_logs").insert({
        lead_id: leadId, action: `Follow-up scheduled for ${scheduled.toLocaleString("en-IN")}`,
        action_type: "system", note: note.trim() || null, performed_by: performedBy,
      });
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Follow-up scheduled");
    setNote("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule follow-up</DialogTitle>
          <DialogDescription>You'll get a reminder at the chosen time.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setWhen(p.kind === "tomorrow_10" ? tomorrow10AM() : isoLocalIn(p.mins))}
              className="h-9 px-3 rounded-full border text-xs font-medium bg-card hover:bg-accent min-w-[44px]"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fu-when">Date &amp; time</Label>
          <Input id="fu-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-11" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fu-note">Note (optional)</Label>
          <Textarea id="fu-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What to discuss?" />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Schedule"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
