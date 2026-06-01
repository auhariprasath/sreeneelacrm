import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateIN } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/feedback/$bookingId")({ component: FeedbackPage });

interface BookingInfo {
  id: string;
  lead_id: string;
  company_id: string;
  event_date: string;
  venue: string | null;
  company_name?: string | null;
  client_name?: string | null;
}

function FeedbackPage() {
  const { bookingId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<BookingInfo | null>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);

  useEffect(() => {
    (async () => {
      // Public read — bookings RLS must allow anon read by id, otherwise this is empty.
      // Falls back to a minimal view via the feedback insert flow.
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, lead_id, company_id, event_date, venue")
        .eq("id", bookingId)
        .maybeSingle();
      if (booking) {
        const [{ data: company }, { data: lead }, { data: prior }] = await Promise.all([
          supabase.from("companies").select("name").eq("id", booking.company_id).maybeSingle(),
          supabase.from("leads").select("full_name").eq("id", booking.lead_id).maybeSingle(),
          supabase.from("feedback").select("id").eq("booking_id", booking.id).limit(1),
        ]);
        if (prior && prior.length > 0) setAlreadyDone(true);
        setInfo({ ...booking, company_name: company?.name ?? null, client_name: lead?.full_name ?? null });
      }
      setLoading(false);
    })();
  }, [bookingId]);

  const submit = async () => {
    if (!info || rating < 1) { toast.error("Please pick a rating"); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("feedback").insert({
        booking_id: info.id,
        lead_id: info.lead_id,
        company_id: info.company_id,
        rating,
        comment: comment.trim() || null,
      });
      if (error) throw error;

      // Low-rating SA alert
      if (rating <= 3) {
        const { data: admins } = await supabase
          .from("user_roles").select("user_id").in("role", ["super_admin", "admin"]);
        const rows = (admins ?? []).map((a: any) => ({
          user_id: a.user_id,
          type: "low_rating" as const,
          title: `Low rating: ${rating}★`,
          body: `${info.client_name ?? "Client"} rated ${rating}/5${comment ? ` — "${comment.slice(0, 80)}"` : ""}`,
          lead_id: info.lead_id,
        }));
        if (rows.length > 0) await supabase.from("notifications").insert(rows);

        await supabase.from("activity_logs").insert({
          lead_id: info.lead_id, action: "Low rating received", action_type: "system",
          note: `Client rated ${rating}/5${comment ? `: "${comment}"` : ""}`, performed_by: null,
        });
      } else {
        await supabase.from("activity_logs").insert({
          lead_id: info.lead_id, action: "Feedback received", action_type: "system",
          note: `Client rated ${rating}/5${comment ? `: "${comment}"` : ""}`, performed_by: null,
        });
      }

      setSubmitted(true);
    } catch (e: any) {
      toast.error(e?.message || "Could not submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-card border rounded-xl p-6 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !info ? (
          <div className="text-center space-y-2">
            <h1 className="text-lg font-semibold">Feedback link invalid</h1>
            <p className="text-sm text-muted-foreground">This feedback link is no longer valid. Please contact your event team.</p>
          </div>
        ) : submitted ? (
          <div className="text-center space-y-3 py-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <h1 className="text-lg font-semibold">Thank you!</h1>
            <p className="text-sm text-muted-foreground">Your feedback helps us improve. We appreciate your time.</p>
          </div>
        ) : alreadyDone ? (
          <div className="text-center space-y-2">
            <h1 className="text-lg font-semibold">Feedback already submitted</h1>
            <p className="text-sm text-muted-foreground">Thanks — we've already received your feedback for this event.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h1 className="text-xl font-semibold">How was your event?</h1>
              {info.company_name && <p className="text-sm text-muted-foreground">{info.company_name}</p>}
              <p className="text-xs text-muted-foreground">Event on {formatDateIN(info.event_date)}{info.venue ? ` · ${info.venue}` : ""}</p>
            </div>

            <div className="flex justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button"
                  onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(n)}
                  className="p-1 transition-transform hover:scale-110 min-h-11 min-w-11"
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}>
                  <Star className={cn("h-8 w-8 transition-colors",
                    (hover || rating) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <div className="text-center text-sm font-medium">
                {rating === 5 ? "Excellent!" : rating === 4 ? "Great" : rating === 3 ? "Okay" : rating === 2 ? "Below expectations" : "Disappointing"}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Tell us more (optional)</Label>
              <Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder="What went well? What can we improve?" maxLength={1000} />
            </div>

            <Button className="w-full min-h-11" onClick={submit} disabled={submitting || rating < 1}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit feedback
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
