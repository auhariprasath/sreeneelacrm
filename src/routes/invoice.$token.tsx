import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import { formatINR, formatDateIN, formatTimeOfDay } from "@/lib/format";
import { getInvoiceByToken } from "@/lib/api/quotations-public.functions";
import { generateInvoicePdf, downloadBlob, type InvoicePdfInput } from "@/lib/invoice-pdf";

export const Route = createFileRoute("/invoice/$token")({
  head: () => ({
    meta: [
      { title: "Your Invoice" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PublicInvoicePage,
  errorComponent: ({ error }) => (
    <div className="min-h-dvh grid place-items-center p-6 text-sm text-muted-foreground">
      Could not load invoice. {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-dvh grid place-items-center p-6 text-sm text-muted-foreground">
      Invoice not found.
    </div>
  ),
});

function PublicInvoicePage() {
  const { token } = Route.useParams();
  const fetchInv = useServerFn(getInvoiceByToken);

  const { data, isLoading } = useQuery({
    queryKey: ["public-invoice", token],
    queryFn: () => fetchInv({ data: { token } }),
  });

  if (isLoading) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data?.invoice) {
    return <div className="min-h-dvh grid place-items-center text-sm text-muted-foreground">Invoice not found.</div>;
  }

  const { invoice, lead, requirement, company } = data;

  const handleDownload = async () => {
    const pdfInput: InvoicePdfInput = {
      company: {
        name: company?.name ?? "",
        address: company?.address ?? null,
        email: company?.email ?? null,
        wa_number: company?.wa_number ?? null,
        gstin: company?.gstin ?? null,
        upi_id: company?.upi_id ?? null,
        bank_account: company?.bank_account ?? null,
        ifsc: company?.ifsc ?? null,
        logo_url: company?.logo_url ?? null,
      },
      client: { name: lead?.full_name ?? "", phone: lead?.phone ?? null },
      event: {
        type: requirement?.event_type ?? null,
        date: requirement?.event_date ?? null,
        start_time: requirement?.start_time ?? null,
        end_time: requirement?.end_time ?? null,
        venue: null,
        guest_count: requirement?.guest_count ?? null,
      },
      invoice: {
        number: invoice.invoice_number || invoice.quotation_number || invoice.id.slice(0, 8),
        issued_at: invoice.invoice_generated_at || invoice.created_at,
        due_date: requirement?.event_date ?? null,
        subtotal: Number(invoice.subtotal),
        discount_amount: Number(invoice.discount_amount),
        gst_amount: Number(invoice.gst_amount),
        total: Number(invoice.total),
        amount_paid: 0,
        balance_due: Number(invoice.total),
      },
    };
    const blob = await generateInvoicePdf(pdfInput);
    downloadBlob(blob, `${pdfInput.invoice.number}.pdf`);
  };

  const services = (invoice.services as Array<{ name: string; amount: number }>) ?? [];
  const addons = (invoice.addons as Array<{ name: string; amount: number; qty?: number }>) ?? [];

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
            <div className="text-xs text-muted-foreground">Invoice · {invoice.invoice_number}</div>
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
                  <span>{s.name}{s.qty ? ` × ${s.qty}` : ""}</span><span>{formatINR(Number(s.amount))}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="p-5 space-y-1 text-sm">
          <Row label="Subtotal" value={formatINR(Number(invoice.subtotal))} />
          {Number(invoice.discount_amount) > 0 && (
            <Row label="Discount" value={`− ${formatINR(Number(invoice.discount_amount))}`} />
          )}
          {invoice.gst_applied && (
            <Row label={`GST (${invoice.gst_percent}%)`} value={formatINR(Number(invoice.gst_amount))} />
          )}
          <div className="flex justify-between pt-2 border-t mt-2 font-semibold text-base">
            <span>Total</span><span>{formatINR(Number(invoice.total))}</span>
          </div>
        </section>

        <footer className="p-5 border-t bg-muted/20">
          <Button onClick={handleDownload} className="w-full min-h-12 text-base font-medium">
            <Download className="h-5 w-5 mr-1.5" /> Download invoice PDF
          </Button>
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
