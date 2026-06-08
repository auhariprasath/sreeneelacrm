import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, MessageSquare, Pencil, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  buildConfirmationMessage,
  buildWaLink,
  loadBookingConfirmationContext,
  loadInvoiceUrlForBooking,
  markConfirmationSent,
  type BookingConfirmationContext,
} from "@/lib/booking-confirmation";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bookingId: string | null;
  onSent?: () => void;
}

export function BookingConfirmationDialog({ open, onOpenChange, bookingId, onSent }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ctx, setCtx] = useState<BookingConfirmationContext | null>(null);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !bookingId) return;
    let cancelled = false;
    setLoading(true);
    setEditing(false);
    (async () => {
      const [c, invoiceUrl] = await Promise.all([
        loadBookingConfirmationContext(bookingId),
        loadInvoiceUrlForBooking(bookingId),
      ]);
      if (cancelled) return;
      setCtx(c);
      setMessage(c ? buildConfirmationMessage(c, invoiceUrl) : "");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, bookingId]);

  const handleSend = async () => {
    if (!ctx) return;
    setSending(true);
    try {
      const url = buildWaLink(ctx.lead.phone, message);
      window.location.href = url;
      await markConfirmationSent({ ctx, message, performedBy: profile?.id ?? null });
      toast.success("Marked as sent · WhatsApp opened");
      onSent?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> Send booking confirmation
          </DialogTitle>
        </DialogHeader>

        {loading || !ctx ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="text-xs text-muted-foreground flex items-center justify-between">
              <span>To <span className="text-foreground font-medium">{ctx.lead.full_name}</span> · {ctx.lead.phone}</span>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing((e) => !e)}>
                <Pencil className="h-3 w-3 mr-1" /> {editing ? "Preview" : "Edit"}
              </Button>
            </div>
            {editing ? (
              <Textarea
                rows={18}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="font-mono text-xs"
              />
            ) : (
              <div className="border rounded-md bg-muted/30 p-3 text-sm whitespace-pre-wrap font-sans">
                {message}
              </div>
            )}
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> Tapping "Send via WhatsApp" opens WhatsApp with this message pre-filled and marks it as sent.
            </div>
          </div>
        )}

        <DialogFooter className="border-t p-3 gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={loading || sending || !ctx} className="min-h-11">
            <Send className="h-4 w-4 mr-1.5" /> Send via WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
