import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";
import { formatINR, formatDateIN, formatTimeOfDay } from "@/lib/format";
import {
  getQuotationByToken,
  markQuotationViewed,
  approveQuotationByToken,
} from "@/lib/api/quotations-public.functions";

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
  const [approved, setApproved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["public-quote", token],
    queryFn: () => fetchQ({ data: { token } }),
  });

  useEffect(() => {
    markViewed({ data: { token } }).catch(() => {});
  }, [token, markViewed]);

  const approveMut = useMutation({
    mutationFn: () => approve({ data: { token } }),
    onSuccess: () => setApproved(true),
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
  const services = (quote.services as Array<{ name: string; amount: number }>) ?? [];
  const addons = (quote.addons as Array<{ name: string; amount: number }>) ?? [];
  const isAgreed = approved || quote.status === "agreed";

  return (
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
          {isAgreed ? (
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
              <CheckCircle2 className="h-5 w-5" /> Approved — thank you! The team will be in touch shortly.
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                onClick={() => approveMut.mutate()}
                disabled={approveMut.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white min-h-11"
              >
                {approveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve quotation</>}
              </Button>
              <div className="text-[11px] text-muted-foreground text-center">
                Have changes? Reply on WhatsApp to {company?.wa_number ?? company?.email ?? "the team"}.
              </div>
            </div>
          )}
        </footer>
      </div>
    </div>
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
