import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Banknote, CheckCircle2, CreditCard, Download, FileText, Loader2, MapPin, MessageSquare, PartyPopper, Smartphone, Building2, Receipt } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatINR, formatDateIN, formatTimeOfDay } from "@/lib/format";
import {
  getQuotationByToken,
  markQuotationViewed,
  approveQuotationByToken,
  requestQuotationChanges,
  createRazorpayOrderForQuotation,
  recordRazorpayPayment,
  savePaymentMethodByToken,
} from "@/lib/api/quotations-public.functions";
import { generateQuotationPdf, downloadBlob } from "@/lib/quotation-pdf";

export const Route = createFileRoute("/quotation/$token")({
  head: () => ({
    meta: [
      { title: "Your Quotation" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PublicQuotationPage,
  errorComponent: ({ error }) => (
    <div className="min-h-dvh grid place-items-center p-6 text-sm text-muted-foreground">
      Could not load quotation. {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-dvh grid place-items-center p-6 text-sm text-muted-foreground">
      Quotation not found.
    </div>
  ),
});

function PublicQuotationPage() {
  const { token } = Route.useParams();
  const fetchQ = useServerFn(getQuotationByToken);
  const markViewed = useServerFn(markQuotationViewed);
  const approve = useServerFn(approveQuotationByToken);
  const requestChanges = useServerFn(requestQuotationChanges);
  const createOrder = useServerFn(createRazorpayOrderForQuotation);
  const recordPayment = useServerFn(recordRazorpayPayment);

  const [approved, setApproved] = useState(false);
  const [requested, setRequested] = useState(false);
  const [showChangesForm, setShowChangesForm] = useState(false);
  const [approvedDialogOpen, setApprovedDialogOpen] = useState(false);
  const [changesDialogOpen, setChangesDialogOpen] = useState(false);
  const [note, setNote] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [paymentStep, setPaymentStep] = useState<"choose" | "method_selected" | "online" | "paid">("choose");
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [savingMethod, setSavingMethod] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  const savePaymentMethod = useServerFn(savePaymentMethodByToken);

  const { data, isLoading } = useQuery({
    queryKey: ["public-quote", token],
    queryFn: () => fetchQ({ data: { token } }),
  });

  useEffect(() => {
    markViewed({ data: { token } }).catch(() => {});
  }, [token, markViewed]);

  const approveMut = useMutation({
    mutationFn: () => approve({ data: { token } }),
    onSuccess: () => { setApproved(true); setApprovedDialogOpen(true); setPaymentStep("choose"); },
  });

  // If already agreed on load, restore payment step state
  useEffect(() => {
    if (!data?.quote) return;
    const q = data.quote as any;
    if (q.status === "agreed" && q.selected_payment_method) {
      setSelectedMethod(q.selected_payment_method);
      setPaymentStep("method_selected");
    }
  }, [data?.quote]);

  const requestMut = useMutation({
    mutationFn: () => requestChanges({ data: { token, note: note.trim() } }),
    onSuccess: () => { setRequested(true); setChangesDialogOpen(true); },
  });

  if (isLoading) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data?.quote) {
    return <div className="min-h-dvh grid place-items-center text-sm text-muted-foreground">Quotation not found.</div>;
  }
  const { quote, lead, requirement, company } = data;

  const handleRazorpayPay = async () => {
    if (!data?.quote) return;
    setPaymentProcessing(true);
    try {
      const result = await createOrder({ data: { token } });
      if (!result.ok) {
        if (result.reason === "no_razorpay") {
          setPaymentStep("cash");
        }
        return;
      }
      const { key_id, order_id, amount } = result;
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Razorpay"));
        document.body.appendChild(script);
      });
      const rzp = new (window as any).Razorpay({
        key: key_id,
        amount,
        currency: "INR",
        order_id,
        name: data.company?.name ?? "Payment",
        description: `Quotation v${data.quote.version}`,
        prefill: { name: data.lead?.full_name ?? "", contact: data.lead?.phone ?? "" },
        handler: async (response: any) => {
          await recordPayment({
            data: {
              token,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            },
          });
          setPaymentStep("paid");
        },
      });
      rzp.open();
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!quote || !lead || !requirement || !company) return;
    setDownloading(true);
    try {
      const blob = await generateQuotationPdf({
        company: { name: company.name, address: company.address, email: company.email, wa_number: company.wa_number, logo_url: company.logo_url },
        client: { name: lead.full_name, phone: lead.phone },
        event: { type: requirement.event_type, date: requirement.event_date, start_time: requirement.start_time, end_time: requirement.end_time, guest_count: requirement.guest_count, venue: (company as any).default_room ?? null },
        quotation: {
          number: (quote as any).quotation_number, version: quote.version,
          services: (quote.services as any) ?? [], addons: (quote.addons as any) ?? [],
          subtotal: Number(quote.subtotal), discount_percent: Number(quote.discount_percent),
          discount_amount: Number(quote.discount_amount), gst_applied: quote.gst_applied,
          gst_percent: Number(quote.gst_percent), gst_amount: Number(quote.gst_amount),
          total: Number(quote.total), created_at: quote.created_at,
        },
        authorisedBy: null,
      });
      if (blob) downloadBlob(blob, `Quotation-v${quote.version}.pdf`);
    } finally { setDownloading(false); }
  };

  type LineRaw = { name?: string; price?: number; amount?: number; quantity?: number };
  const toAmount = (r: LineRaw) =>
    Number(r.amount ?? 0) || (Number(r.price ?? 0) * (Number(r.quantity ?? 1) || 1));
  const services = ((quote.services as LineRaw[]) ?? []).map((s) => ({ name: s.name ?? "", amount: toAmount(s) }));
  const addons = ((quote.addons as LineRaw[]) ?? []).map((s) => ({ name: s.name ?? "", amount: toAmount(s) }));
  const isAgreed = approved || quote.status === "agreed";
  const isDeclined = requested || quote.status === "declined";
  const isExpired = quote.status === "expired";

  return (
    <>
    <Dialog open={approvedDialogOpen} onOpenChange={setApprovedDialogOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-center text-center">
            <PartyPopper className="h-6 w-6 text-success" />
            Quotation Approved!
          </DialogTitle>
        </DialogHeader>
        <div className="py-3 text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <p className="text-sm text-muted-foreground">
            Thank you for approving! Our team has been notified and will reach out shortly to confirm your booking details and next steps.
          </p>
        </div>
        <Button onClick={() => setApprovedDialogOpen(false)} className="w-full bg-success hover:bg-success/90 text-white">
          Great, thank you!
        </Button>
      </DialogContent>
    </Dialog>

    <Dialog open={changesDialogOpen} onOpenChange={setChangesDialogOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-center text-center">
            <MessageSquare className="h-5 w-5 text-warning" />
            Request Received
          </DialogTitle>
        </DialogHeader>
        <div className="py-3 text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
            <MessageSquare className="h-8 w-8 text-warning" />
          </div>
          <p className="text-sm text-muted-foreground">
            We've received your change request and shared it with our team. We'll get back to you with a revised quotation as soon as possible.
          </p>
        </div>
        <Button variant="outline" onClick={() => setChangesDialogOpen(false)} className="w-full">
          Done
        </Button>
      </DialogContent>
    </Dialog>

    <div className="min-h-dvh bg-muted/30 py-6 px-4">
      <div className="max-w-2xl mx-auto bg-card border rounded-lg shadow-sm overflow-hidden">
        <header className="p-5 border-b flex items-center gap-3">
          {company?.logo_url ? (
            <img src={company.logo_url} alt="" className="h-10 w-10 rounded object-cover" />
          ) : (
            <div className="h-10 w-10 rounded bg-primary/10 grid place-items-center"><FileText className="h-5 w-5 text-primary" /></div>
          )}
          <div className="min-w-0">
            <div className="font-semibold">{company?.name}</div>
            <div className="text-xs text-muted-foreground">Quotation v{quote.version} · {quote.quotation_number ?? quote.id.slice(0, 6)}</div>
          </div>
        </header>

        <section className="p-5 space-y-1 text-sm border-b">
          <div className="font-medium">For {lead?.full_name}</div>
          <div className="text-muted-foreground text-xs">
            {requirement?.event_type ?? "Event"}
            {requirement?.event_date && ` · ${formatDateIN(requirement.event_date)}`}
            {requirement?.start_time && ` · ${formatTimeOfDay(requirement.start_time)}`}
            {requirement?.end_time && ` – ${formatTimeOfDay(requirement.end_time)}`}
            {(company as any)?.default_room && ` · ${(company as any).default_room}`}
          </div>
        </section>

        <section className="p-5 space-y-3 text-sm border-b">
          {services.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Services</div>
              {services.map((s, i) => (
                <div key={i} className="flex justify-between py-1 border-b border-dashed last:border-0">
                  <span>{s.name}</span><span>{formatINR(Number(s.amount))}</span>
                </div>
              ))}
            </div>
          )}
          {addons.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5 mt-2">Add-ons</div>
              {addons.map((s, i) => (
                <div key={i} className="flex justify-between py-1 border-b border-dashed last:border-0">
                  <span>{s.name}</span><span>{formatINR(Number(s.amount))}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="p-5 space-y-1 text-sm">
          <Row label="Subtotal" value={formatINR(Number(quote.subtotal))} />
          {Number(quote.discount_amount) > 0 && (
            <Row label={`Discount${quote.discount_percent ? ` (${quote.discount_percent}%)` : ""}`} value={`− ${formatINR(Number(quote.discount_amount))}`} />
          )}
          {quote.gst_applied && (
            <Row label={`GST (${quote.gst_percent}%)`} value={formatINR(Number(quote.gst_amount))} />
          )}
          <div className="flex justify-between pt-2 border-t mt-2 font-semibold text-base">
            <span>Total</span><span>{formatINR(Number(quote.total))}</span>
          </div>
        </section>

        <footer className="p-5 border-t bg-muted/20">
          {isExpired ? (
            <div className="text-sm text-destructive dark:text-destructive font-medium">
              This quotation has expired. Please contact us for a fresh one.
            </div>
          ) : isAgreed ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-success dark:text-success text-sm font-medium">
                <CheckCircle2 className="h-5 w-5" /> Approved — thank you!
              </div>

              {/* Step 1: Choose payment method */}
              {paymentStep === "choose" && (
                <div className="space-y-3">
                  <div className="text-sm font-semibold">How would you like to make the payment?</div>
                  <div className="text-xs text-muted-foreground">Select your preferred payment method so we can prepare accordingly.</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { key: "cash", label: "Cash", icon: Banknote, desc: "Pay in cash at our venue" },
                      { key: "cheque", label: "Cheque", icon: Receipt, desc: "Pay by cheque" },
                      { key: "bank_transfer", label: "Bank Transfer", icon: Building2, desc: "NEFT / RTGS / IMPS" },
                      { key: "upi", label: "UPI", icon: Smartphone, desc: "GPay, PhonePe, Paytm, etc." },
                      ...((company as any)?.payment_method === "razorpay"
                        ? [{ key: "razorpay", label: "Pay Online", icon: CreditCard, desc: "Cards, UPI, Net Banking" }]
                        : []),
                    ].map(({ key, label, icon: Icon, desc }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedMethod(key)}
                        className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                          selectedMethod === key
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/40"
                        }`}
                      >
                        <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${selectedMethod === key ? "text-primary" : "text-muted-foreground"}`} />
                        <div>
                          <div className="text-sm font-medium">{label}</div>
                          <div className="text-xs text-muted-foreground">{desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <Button
                    className="w-full min-h-11"
                    disabled={!selectedMethod || savingMethod}
                    onClick={async () => {
                      if (!selectedMethod) return;
                      setSavingMethod(true);
                      await savePaymentMethod({ data: { token, payment_method: selectedMethod as any } });
                      setSavingMethod(false);
                      if (selectedMethod === "razorpay") {
                        setPaymentStep("online");
                      } else {
                        setPaymentStep("method_selected");
                      }
                    }}
                  >
                    {savingMethod ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm payment method"}
                  </Button>
                </div>
              )}

              {/* Step 2a: Non-online payment confirmed */}
              {paymentStep === "method_selected" && (
                <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Payment method confirmed — {selectedMethod?.replace("_", " ")}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Our team has been notified of your preferred payment method and will be in touch with the payment details.
                  </p>
                  {(company as any)?.full_address && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground border-t pt-2 mt-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                      {(company as any).full_address}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2b: Online payment via Razorpay */}
              {paymentStep === "online" && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Complete your payment online</div>
                  <Button
                    className="w-full min-h-12"
                    onClick={handleRazorpayPay}
                    disabled={paymentProcessing}
                  >
                    {paymentProcessing
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <><CreditCard className="h-5 w-5 mr-1.5" /> Pay {formatINR(Number(quote.total))} Online</>}
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => { setSelectedMethod(null); setPaymentStep("choose"); }}>
                    Change payment method
                  </Button>
                </div>
              )}

              {/* Step 3: Razorpay paid */}
              {paymentStep === "paid" && (
                <div className="flex items-center gap-2 text-success dark:text-success text-sm font-medium">
                  <CheckCircle2 className="h-5 w-5" /> Payment successful — the team will be in touch shortly.
                </div>
              )}
            </div>
          ) : isDeclined ? (
            <div className="flex items-center gap-2 text-warning dark:text-warning text-sm font-medium">
              <MessageSquare className="h-5 w-5" /> We've shared your requested changes with the team — they'll respond shortly.
            </div>
          ) : showChangesForm ? (
            <div className="space-y-2">
              <div className="text-sm font-medium">Tell us what you'd like changed</div>
              <Textarea
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Please increase guest count to 250, reduce floral budget…"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 min-h-11"
                  onClick={() => { setShowChangesForm(false); setNote(""); }}
                  disabled={requestMut.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 min-h-11"
                  onClick={() => requestMut.mutate()}
                  disabled={requestMut.isPending || !note.trim()}
                >
                  {requestMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send request"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  onClick={() => approveMut.mutate()}
                  disabled={approveMut.isPending}
                  className="bg-success hover:bg-success text-white min-h-12 text-base font-medium"
                >
                  {approveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-5 w-5 mr-1.5" /> Approve</>}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowChangesForm(true)}
                  className="min-h-12 text-base font-medium"
                >
                  <MessageSquare className="h-5 w-5 mr-1.5" /> Request changes
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={handleDownloadPdf}
                disabled={downloading}
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
                Download PDF
              </Button>
            </div>
          )}
        </footer>
      </div>
    </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
