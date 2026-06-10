import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(6).max(128).regex(/^[a-z0-9_-]+$/i) });
const requestChangesSchema = z.object({
  token: z.string().min(6).max(128).regex(/^[a-z0-9_-]+$/i),
  note: z.string().trim().min(1).max(2000),
});
const razorpayVerifySchema = z.object({
  token: z.string().min(6).max(128).regex(/^[a-z0-9_-]+$/i),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_signature: z.string().min(1).max(256),
});

async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const getQuotationByToken = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(async ({ data }) => {
    try {
      const adm = await getAdminClient();
      const { data: q } = await adm
        .from("quotations")
        .select("*")
        .eq("public_token", data.token)
        .is("deleted_at", null)
        .maybeSingle();
      if (!q) return { quote: null, lead: null, requirement: null, company: null };
      const [{ data: lead }, { data: requirement }, { data: company }] = await Promise.all([
        adm.from("leads").select("id, full_name, phone").eq("id", q.lead_id).maybeSingle(),
        adm.from("requirements").select("id, event_type, event_date, start_time, end_time, guest_count").eq("id", q.requirement_id).maybeSingle(),
        adm.from("companies").select("id, name, logo_url, wa_number, email, address, default_room, payment_method, full_address, cancellation_policy").eq("id", q.company_id).maybeSingle(),
      ]);
      return { quote: q, lead: lead ?? null, requirement: requirement ?? null, company: company ?? null };
    } catch {
      return { quote: null, lead: null, requirement: null, company: null };
    }
  });

export const markQuotationViewed = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(async ({ data }) => {
    try {
      const adm = await getAdminClient();
      const { data: q } = await adm
        .from("quotations")
        .select("id, lead_id, version, viewed_at, view_count, created_by")
        .eq("public_token", data.token)
        .maybeSingle();
      if (!q) return { ok: false };
      const isFirst = !q.viewed_at;
      await adm.from("quotations").update({
        viewed_at: q.viewed_at ?? new Date().toISOString(),
        view_count: (q.view_count ?? 0) + 1,
      }).eq("id", q.id);
      await adm.from("activity_logs").insert({
        lead_id: q.lead_id,
        action: isFirst
          ? `Quotation v${q.version} viewed by client`
          : `Quotation v${q.version} re-opened by client`,
        action_type: "system",
        performed_by: null,
        metadata: { quotation_id: q.id, view_count: (q.view_count ?? 0) + 1 },
      });
      if (isFirst && q.created_by) {
        await adm.from("notifications").insert({
          user_id: q.created_by,
          title: "Quotation viewed",
          body: `Client opened quotation v${q.version}`,
          type: "system",
          lead_id: q.lead_id,
        });
      }
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

export const approveQuotationByToken = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(async ({ data }) => {
    try {
      const adm = await getAdminClient();
      const { data: q } = await adm
        .from("quotations")
        .select("id, lead_id, version, status, created_by, total")
        .eq("public_token", data.token)
        .maybeSingle();
      if (!q) return { ok: false };
      if (q.status === "agreed") return { ok: true, already: true };
      const now = new Date().toISOString();
      await adm.from("quotations").update({ status: "agreed", agreed_at: now, approved_at: now }).eq("id", q.id);
      await adm.from("activity_logs").insert({
        lead_id: q.lead_id,
        action: `Client APPROVED quotation v${q.version} via public link`,
        action_type: "status_change",
        performed_by: null,
        metadata: { quotation_id: q.id },
      });
      if (q.created_by) {
        await adm.from("notifications").insert({
          user_id: q.created_by,
          title: "Quotation approved",
          body: `Client approved quotation v${q.version} — ready to book`,
          type: "system",
          lead_id: q.lead_id,
        });
      }
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

export const requestQuotationChanges = createServerFn({ method: "POST" })
  .validator(requestChangesSchema)
  .handler(async ({ data }) => {
    try {
      const adm = await getAdminClient();
      const { data: q } = await adm
        .from("quotations")
        .select("id, lead_id, version, status, created_by")
        .eq("public_token", data.token)
        .maybeSingle();
      if (!q) return { ok: false };
      if (q.status === "agreed") return { ok: false, reason: "already_approved" };
      await adm.from("quotations").update({ status: "declined" }).eq("id", q.id);
      await adm.from("activity_logs").insert({
        lead_id: q.lead_id,
        action: `Client requested CHANGES on quotation v${q.version}`,
        action_type: "status_change",
        performed_by: null,
        metadata: { quotation_id: q.id, note: data.note },
      });
      if (q.created_by) {
        await adm.from("notifications").insert({
          user_id: q.created_by,
          title: "Client requested changes",
          body: `On quotation v${q.version}: "${data.note.slice(0, 140)}"`,
          type: "system",
          lead_id: q.lead_id,
        });
      }
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

export const createRazorpayOrderForQuotation = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(async ({ data }) => {
    // Razorpay requires secret key — keep using admin client for this payment operation only
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const adm = supabaseAdmin as any;
      const { data: q } = await adm
        .from("quotations")
        .select("id, total, status, company_id, version")
        .eq("public_token", data.token)
        .maybeSingle();
      if (!q || q.status !== "agreed") return { ok: false as const, reason: "not_agreed" };
      const { data: creds } = await adm
        .from("company_payment_credentials")
        .select("razorpay_key_id, razorpay_key_secret")
        .eq("company_id", q.company_id)
        .maybeSingle();
      const row = creds as any;
      if (!row?.razorpay_key_id || !row?.razorpay_key_secret) return { ok: false as const, reason: "no_razorpay" };
      const amountPaise = Math.round(Number(q.total) * 100);
      const credentials = btoa(`${row.razorpay_key_id}:${row.razorpay_key_secret}`);
      const res = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt: q.id.slice(0, 40) }),
      });
      if (!res.ok) return { ok: false as const, reason: "razorpay_error" };
      const order = await res.json() as { id: string };
      return { ok: true as const, key_id: row.razorpay_key_id as string, order_id: order.id, amount: amountPaise };
    } catch {
      return { ok: false as const, reason: "no_razorpay" };
    }
  });

export const recordRazorpayPayment = createServerFn({ method: "POST" })
  .validator(razorpayVerifySchema)
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const adm = supabaseAdmin as any;
      const { data: q } = await adm
        .from("quotations")
        .select("id, lead_id, total, version, company_id, created_by")
        .eq("public_token", data.token)
        .maybeSingle();
      if (!q) return { ok: false };
      const amountFmt = Number(q.total).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
      await adm.from("activity_logs").insert({
        lead_id: q.lead_id,
        action: `Online payment received — ${amountFmt} via Razorpay`,
        action_type: "payment",
        metadata: { payment_id: data.razorpay_payment_id, order_id: data.razorpay_order_id, quotation_id: q.id },
      });
      if (q.created_by) {
        await adm.from("notifications").insert({
          user_id: q.created_by,
          title: "Payment received online",
          body: `Razorpay payment ${amountFmt} received for quotation v${q.version}`,
          type: "system",
          lead_id: q.lead_id,
        });
      }
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

export const getInvoiceByToken = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const adm = supabaseAdmin as any;
      const { data: q } = await adm
        .from("quotations").select("*").eq("public_token", data.token)
        .is("deleted_at", null).not("invoice_generated_at", "is", null).maybeSingle();
      if (!q) return { invoice: null, lead: null, requirement: null, company: null };
      const [{ data: l }, { data: r }, { data: c }] = await Promise.all([
        adm.from("leads").select("id,full_name,phone,email").eq("id", q.lead_id).maybeSingle(),
        adm.from("requirements").select("id,event_type,event_date,start_time,end_time,guest_count").eq("id", q.requirement_id).maybeSingle(),
        adm.from("companies").select("id,name,logo_url,wa_number,email,address,gstin,upi_id,bank_account,ifsc").eq("id", q.company_id).maybeSingle(),
      ]);
      return { invoice: q, lead: l, requirement: r, company: c };
    } catch {
      return { invoice: null, lead: null, requirement: null, company: null };
    }
  });
