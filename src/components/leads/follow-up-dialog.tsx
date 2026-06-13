import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Clock, Sunrise, CalendarClock, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { TimeClockField } from "@/components/ui/time-clock-picker";
import { DateConfirmField } from "@/components/ui/date-confirm-field";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  performedBy: string | null;
  defaultMinutesFromNow?: number;
}

type PresetKey = "1h" | "3h" | "tom10" | "custom";

const PRESETS: { key: PresetKey; label: string; icon: any; sub: string }[] = [
  { key: "1h",    label: "In 1 hour",      icon: Clock,         sub: "Quick follow-up" },
  { key: "3h",    label: "In 3 hours",     icon: Clock,         sub: "Later today" },
  { key: "tom10", label: "Tomorrow 10 AM", icon: Sunrise,       sub: "Morning callback" },
  { key: "custom",label: "Custom time",    icon: CalendarClock, sub: "Pick date & time" },
];

function pad(n: number) { return String(n).padStart(2, "0"); }
function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function presetDate(key: PresetKey, defaultMins: number): Date {
  const d = new Date();
  if (key === "1h") d.setTime(Date.now() + 60*60_000);
  else if (key === "3h") d.setTime(Date.now() + 3*60*60_000);
  else if (key === "tom10") { d.setDate(d.getDate()+1); d.setHours(10,0,0,0); }
  else d.setTime(Date.now() + defaultMins*60_000);
  d.setSeconds(0,0);
  return d;
}

export function FollowUpDialog({ open, onOpenChange, leadId, performedBy, defaultMinutesFromNow = 60 }: Props) {
  const [selected, setSelected] = useState<PresetKey | null>(null);
  const [when, setWhen] = useState<string>(() => toLocalInput(presetDate("1h", defaultMinutesFromNow)));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [pulse, setPulse] = useState(false);
  const pulseTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setSelected(null); setNote(""); setPulse(false);
      if (pulseTimer.current) { window.clearTimeout(pulseTimer.current); pulseTimer.current = null; }
      return;
    }
  }, [open]);

  const pickPreset = (key: PresetKey) => {
    if (selected) return; // locked
    setSelected(key);
    setWhen(toLocalInput(presetDate(key, defaultMinutesFromNow)));
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => setPulse(true), 30_000);
  };

  const save = async () => {
    const scheduled = new Date(when);
    if (isNaN(scheduled.getTime())) { toast.error("Invalid date/time"); return; }
    if (scheduled.getTime() < Date.now() - 60_000) { toast.error("Pick a time in the future"); return; }

    setSaving(true);
    // Only one active reminder per lead — close any pending follow-ups or venue meetings.
    const { closeOtherActiveReminders } = await import("@/lib/lead-reminders");
    await closeOtherActiveReminders(leadId);
    const { error } = await supabase.from("follow_ups").insert({
      lead_id: leadId, scheduled_at: scheduled.toISOString(),
      note: note.trim() || null, created_by: performedBy,
    });
    if (!error) {
      await supabase.from("leads").update({ status: "follow_up" as any }).eq("id", leadId);
      await supabase.from("activity_logs").insert({
        lead_id: leadId,
        action: `Callback scheduled for ${scheduled.toLocaleString("en-IN")}`,
        action_type: "system",
        note: note.trim() || null,
        performed_by: performedBy,
      });
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Callback scheduled for ${scheduled.toLocaleString("en-IN")} ✓`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule callback</DialogTitle>
          <DialogDescription>
            {selected ? "Locked in. Tap Confirm to save." : "Tap one option to lock it in."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => {
            const Icon = p.icon;
            const isSelected = selected === p.key;
            const isDimmed = selected && !isSelected;
            return (
              <button
                key={p.key}
                onClick={() => pickPreset(p.key)}
                disabled={!!selected && !isSelected}
                className={cn(
                  "relative text-left rounded-xl border-2 p-3 min-h-[88px] transition-all",
                  "active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary cursor-default"
                    : isDimmed
                      ? "border-border bg-card opacity-40 cursor-not-allowed"
                      : "border-border bg-card hover:border-primary/50 hover:bg-primary/5",
                )}
              >
                <div className="flex items-center justify-between">
                  <Icon className="h-4 w-4" />
                  {isSelected && <Lock className="h-3.5 w-3.5" />}
                </div>
                <div className="mt-2 text-sm font-semibold">{p.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{p.sub}</div>
              </button>
            );
          })}
        </div>

        {selected === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <DateConfirmField
                value={when.slice(0, 10)}
                onChange={(d) => setWhen(`${d}T${when.slice(11, 16) || "10:00"}`)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <TimeClockField
                value={when.slice(11, 16) || "10:00"}
                onChange={(t) => setWhen(`${when.slice(0, 10) || new Date().toISOString().slice(0, 10)}T${t}`)}
              />
            </div>
          </div>
        )}

        {selected && (
          <div className="space-y-1.5">
            <Label htmlFor="fu-note">Note (optional)</Label>
            <Textarea id="fu-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What to discuss?" />
          </div>
        )}

        {selected && (
          <Button
            onClick={save}
            disabled={saving}
            className={cn(
              "h-12 w-full text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground",
              pulse && "animate-pulse ring-4 ring-primary/40",
            )}
          >
            <Check className="h-5 w-5 mr-2" />
            {saving ? "Saving…" : "Confirm schedule"}
          </Button>
        )}

        {!selected && (
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
