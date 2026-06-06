import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertTriangle, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateIN, formatINR } from "@/lib/format";
import { buildWaMeLink } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  booking: Booking;
  leadId: string;
  leadPhone?: string | null;
  onDone?: () => void;
}

export function EventCompleteDialog({ open, onOpenChange, booking, leadId, leadPhone, onDone }: Props) {
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [feedbackUrl, setFeedbackUrl] = useState<string | null>(null);

  const eventDate = new Date(booking.event_date);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const beforeEvent = eventDate.getTime() > today.getTime();
  const balanceDue = Number(booking.balance_due ?? 0);

  const submit = async () => {
    setSubmitting(true);
    try {
      // Load company prefs
      const { data: company } = await supabase
        .from("companies").select("feedback_wa_delay_hours, reengagement_delay_days, wa_template_feedback")
        .eq("id", booking.company_id).maybeSingle();

      const now = new Date();
      const feedbackAt = new Date(now.getTime() + (company?.feedback_wa_delay_hours ?? 24) * 3600_000);
      const reengageAt = new Date(now.getTime() + (company?.reengagement_delay_days ?? 30) * 86400_000);

      const { error } = await supabase.from("bookings").update({
        status: "completed",
        completed_at: now.toISOString(),
        completed_by: profile?.id ?? null,
        feedback_wa_scheduled_at: feedbackAt.toISOString(),
        reengagement_scheduled_at: reengageAt.toISOString(),
      }).eq("id", booking.id);
      if (error) throw error;

      await supabase.from("activity_logs").insert({
        lead_id: leadId, action: "Event marked complete", action_type: "system",
        note: notes || `Event on ${formatDateIN(booking.event_date)} marked completed.`,
        performed_by: profile?.id ?? null,
      });

      const url = `${window.location.origin}/feedback/${booking.id}`;
      setFeedbackUrl(url);
      toast.success("Event marked complete");
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message || "Failed to complete event");
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    setNotes(""); setFeedbackUrl(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Mark event complete
          </DialogTitle>
          <DialogDescription>
            Confirm the event happened. Feedback request and re-engagement will be scheduled automatically.
          </DialogDescription>
        </DialogHeader>

        {feedbackUrl ? (
          <div className="space-y-3">
            <div className="text-sm">Share this feedback link with the client:</div>
            <div className="flex items-center gap-2 p-2 rounded-md border bg-muted text-xs break-all">
              <span className="flex-1">{feedbackUrl}</span>
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0"
                onClick={() => { navigator.clipboard.writeText(feedbackUrl); toast.success("Link copied"); }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            {leadPhone && (
              <a
                href={buildWaMeLink(leadPhone, `Thanks for choosing us! We'd love your feedback: ${feedbackUrl}`) ?? undefined}
                target="_blank" rel="noreferrer"
                className="inline-flex h-9 items-center justify-center rounded-md bg-emerald-600 px-3 text-sm text-white hover:bg-emerald-700 w-full"
              >
                Send via WhatsApp
              </a>
            )}
            <Button variant="outline" className="w-full" onClick={close}>Done</Button>
          </div>
        ) : (
          <>
            <div className="space-y-3 text-sm">
              <div className="rounded-md border bg-muted/40 p-2 text-xs space-y-1">
                <div><span className="text-muted-foreground">Event date:</span> <span className="font-medium">{formatDateIN(booking.event_date)}</span></div>
                {booking.venue && <div><span className="text-muted-foreground">Venue:</span> {booking.venue}</div>}
                <div><span className="text-muted-foreground">Balance due:</span> <span className={balanceDue > 0 ? "font-semibold text-rose-600" : "font-semibold text-emerald-600"}>{formatINR(balanceDue)}</span></div>
              </div>

              {beforeEvent && (
                <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>The event date hasn't arrived yet. Are you sure?</span>
                </div>
              )}
              {balanceDue > 0 && (
                <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Balance of {formatINR(balanceDue)} is still pending. Mark complete anyway?</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Closing notes (optional)</Label>
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="How did it go? Any issues, highlights, or items to follow up on…" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={close} disabled={submitting}>Cancel</Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Mark complete
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
