import { supabase } from "@/integrations/supabase/client";
import { generateInvoicePdf, downloadBlob, type InvoicePdfInput } from "@/lib/invoice-pdf";
import type { Database } from "@/integrations/supabase/types";

type Quotation = Database["public"]["Tables"]["quotations"]["Row"];

export interface InvoiceBundle {
  quote: Quotation;
  lead: Database["public"]["Tables"]["leads"]["Row"];
  requirement: Database["public"]["Tables"]["requirements"]["Row"];
  company: Database["public"]["Tables"]["companies"]["Row"];
}

export async function loadInvoiceBundle(quotationId: string): Promise<InvoiceBundle | null> {
  const { data: q } = await supabase.from("quotations").select("*").eq("id", quotationId).maybeSingle();
  if (!q) return null;
  const [{ data: lead }, { data: req }, { data: company }] = await Promise.all([
    supabase.from("leads").select("*").eq("id", q.lead_id).maybeSingle(),
    supabase.from("requirements").select("*").eq("id", q.requirement_id).maybeSingle(),
    supabase.from("companies").select("*").eq("id", q.company_id).maybeSingle(),
  ]);
  if (!lead || !req || !company) return null;
  return { quote: q as Quotation, lead: lead as any, requirement: req as any, company: company as any };
}

/** Assign next invoice number for the company: INV-YYYY-NNNN. */
async function nextInvoiceNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const { data } = await supabase
    .from("quotations")
    .select("invoice_number")
    .eq("company_id", companyId)
    .like("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1);
  const last = data?.[0]?.invoice_number ?? null;
  const lastSeq = last ? parseInt(last.slice(prefix.length), 10) : 0;
  const next = (isNaN(lastSeq) ? 0 : lastSeq) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function toPdfInput(b: InvoiceBundle): InvoicePdfInput {
  const { quote, lead, requirement, company } = b;
  return {
    company: {
      name: company.name,
      address: company.address,
      email: company.email,
      wa_number: company.wa_number,
      gstin: company.gstin,
      upi_id: company.upi_id,
      bank_account: company.bank_account,
      ifsc: company.ifsc,
      logo_url: company.logo_url,
    },
    client: { name: lead.full_name, phone: lead.phone },
    event: {
      type: requirement.event_type,
      date: requirement.event_date,
      start_time: requirement.start_time,
      end_time: requirement.end_time,
      venue: null,
      guest_count: requirement.guest_count,
    },
    invoice: {
      number: quote.invoice_number || quote.quotation_number || quote.id.slice(0, 8),
      issued_at: quote.invoice_generated_at || new Date().toISOString(),
      due_date: requirement.event_date,
      subtotal: Number(quote.subtotal),
      discount_amount: Number(quote.discount_amount),
      gst_amount: Number(quote.gst_amount),
      total: Number(quote.total),
      amount_paid: 0,
      balance_due: Number(quote.total),
    },
  };
}

/** Generate invoice number + mark generated_at + download PDF. Returns updated invoice_number. */
export async function generateInvoiceForQuotation(
  quotationId: string,
  performedBy: string | null,
): Promise<{ invoice_number: string; bundle: InvoiceBundle } | null> {
  const bundle = await loadInvoiceBundle(quotationId);
  if (!bundle) return null;
  let invoice_number = bundle.quote.invoice_number ?? null;
  if (!invoice_number) {
    invoice_number = await nextInvoiceNumber(bundle.company.id);
  }
  const now = new Date().toISOString();
  await supabase
    .from("quotations")
    .update({
      invoice_number,
      invoice_generated_at: bundle.quote.invoice_generated_at ?? now,
    })
    .eq("id", quotationId);

  await supabase.from("activity_logs").insert({
    lead_id: bundle.lead.id,
    action: `Invoice ${invoice_number} generated from quotation v${bundle.quote.version}`,
    action_type: "system",
    performed_by: performedBy,
    metadata: { quotation_id: quotationId, invoice_number },
  });

  bundle.quote.invoice_number = invoice_number;
  bundle.quote.invoice_generated_at = bundle.quote.invoice_generated_at ?? now;

  const blob = await generateInvoicePdf(toPdfInput(bundle));
  downloadBlob(blob, `${invoice_number}.pdf`);
  return { invoice_number, bundle };
}

/** Download an already-generated invoice PDF (no DB writes). */
export async function downloadInvoicePdf(quotationId: string): Promise<boolean> {
  const bundle = await loadInvoiceBundle(quotationId);
  if (!bundle || !bundle.quote.invoice_number) return false;
  const blob = await generateInvoicePdf(toPdfInput(bundle));
  downloadBlob(blob, `${bundle.quote.invoice_number}.pdf`);
  return true;
}

/** Mark invoice as sent (does NOT open wa.me — caller handles that). */
export async function markInvoiceSent(quotationId: string, performedBy: string | null) {
  const { data: q } = await supabase
    .from("quotations")
    .select("id,lead_id,version,invoice_number")
    .eq("id", quotationId)
    .maybeSingle();
  if (!q) return;
  const now = new Date().toISOString();
  await supabase.from("quotations").update({ invoice_sent_at: now }).eq("id", quotationId);
  await supabase.from("activity_logs").insert({
    lead_id: q.lead_id,
    action: `Invoice ${q.invoice_number ?? ""} sent via WhatsApp`.trim(),
    action_type: "system",
    performed_by: performedBy,
    metadata: { quotation_id: quotationId, invoice_number: q.invoice_number },
  });
}
