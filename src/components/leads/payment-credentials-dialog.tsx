import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, IndianRupee, Link as LinkIcon, Loader2, Copy } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { buildWaMeLink, openWaMeLink } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  leadName: string;
  leadPhone: string;
  companyId: string;
  bookingId?: string | null;
  amount?: number | null;
}

export function PaymentCredentialsDialog({ open, onOpenChange, leadId, leadName, leadPhone, companyId, bookingId, amount }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"manual" | "razorpay">("manual");
  const [generating, setGenerating] = useState(false);
  const [rzpLink, setRzpLink] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setMessage(""); setRzpLink(null); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("companies")
        .select("name,bank_account,ifsc,upi_id,payment_method")
        .eq("id", companyId).maybeSingle();
      const c = data as any;
      setPaymentMethod((c?.payment_method as any) || "manual");
      const msg = `Hi ${leadName}, here are our payment details for your booking:

Bank: ${c?.name ?? ""}
Account number: ${c?.bank_account ?? "—"}
IFSC: ${c?.ifsc ?? "—"}
Account name: ${c?.name ?? ""}
UPI ID: ${c?.upi_id ?? "—"}

Please share the transaction screenshot after payment.

Thank you!`;
      setMessage(msg);
      setLoading(false);
    })();
  }, [open, companyId, leadName]);

  const send = async () => {
    const url = buildWaMeLink(leadPhone, rzpLink ? `${message}\n\nPay online: ${rzpLink}` : message);
    if (!url) { toast.error("Invalid phone number"); return; }
    openWaMeLink(url);
    await supabase.from("activity_logs").insert({
      lead_id: leadId,
      action: rzpLink ? "Payment credentials + Razorpay link sent" : "Payment credentials sent",
      action_type: "system",
      performed_by: profile?.id ?? null,
    });
    toast.success("WhatsApp opened ✓");
    onOpenChange(false);
  };

  const generateRzpLink = async () => {
    if (!bookingId || !amount) { toast.error("Booking and amount required"); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("razorpay-create-link", {
        body: { booking_id: bookingId, amount, lead_name: leadName, lead_phone: leadPhone, company_id: companyId },
      });
      if (error) throw error;
      if ((data as any)?.short_url) {
        setRzpLink((data as any).short_url);
        toast.success("Payment link created ✓");
      } else throw new Error("No link returned");
    } catch (e: any) {
      toast.error(e.message || "Couldn't create link. Check Razorpay keys in Settings.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><IndianRupee className="h-4 w-4" /> Payment credentials</DialogTitle>
          <DialogDescription>Preview and edit before sending to {leadName}.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Message</Label>
              <Textarea rows={10} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            {paymentMethod === "razorpay" && bookingId && amount && (
              <div className="border rounded-md p-3 bg-muted/30 space-y-2">
                <div className="text-xs font-semibold flex items-center gap-1.5"><LinkIcon className="h-3 w-3" /> Razorpay link</div>
                {rzpLink ? (
                  <div className="text-xs break-all bg-background border rounded px-2 py-1.5">{rzpLink}</div>
                ) : (
                  <Button size="sm" variant="outline" onClick={generateRzpLink} disabled={generating}>
                    {generating ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Generating…</> : "Generate payment link"}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {bookingId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                const { data } = await supabase
                  .from("payments")
                  .select("public_token")
                  .eq("booking_id", bookingId)
                  .is("deleted_at", null)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                const token = (data as { public_token?: string } | null)?.public_token;
                if (!token) { toast.error("No payment record yet — create one first"); return; }
                const url = `${window.location.origin}/payment/${token}`;
                await navigator.clipboard.writeText(url);
                toast.success("Payment link copied");
              }}
            >
              <Copy className="h-4 w-4 mr-1" /> Copy payment link
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={loading}>
            <Send className="h-4 w-4 mr-1" /> Send via WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
