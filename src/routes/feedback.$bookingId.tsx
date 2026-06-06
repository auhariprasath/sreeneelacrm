import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateIN } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getFeedbackBooking, submitFeedback } from "@/lib/api/feedback-public.functions";

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
  const fetchInfo = useServerFn(getFeedbackBooking);
  const sendFeedback = useServerFn(submitFeedback);
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
      try {
        const res = await fetchInfo({ data: { booking_id: bookingId } });
        if (res.booking) {
          setInfo({ ...res.booking, company_name: res.company_name, client_name: res.client_name });
        }
      } catch {
        // ignore — UI will show invalid link
      }
      setLoading(false);
    })();
  }, [bookingId, fetchInfo]);

  const submit = async () => {
    if (!info || rating < 1) { toast.error("Please pick a rating"); return; }
    setSubmitting(true);
    try {
      const res = await sendFeedback({ data: { booking_id: info.id, rating, comment: comment.trim() || undefined } });
      if (!res.ok) {
        if (res.error === "already_submitted") { setAlreadyDone(true); return; }
        throw new Error(res.error === "invalid_booking" ? "Feedback link invalid" : "Could not submit feedback");
      }
      setSubmitted(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit feedback");
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
