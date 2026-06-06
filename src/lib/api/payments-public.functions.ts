import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const uploadSchema = z.object({
  token: z.string().min(8).max(128).regex(/^[a-f0-9]+$/i),
  filename: z.string().min(1).max(200),
  content_type: z.string().min(1).max(100).regex(/^[a-zA-Z0-9.+\-/]+$/),
  // base64-encoded file content; cap at ~7MB raw (~9.5MB base64)
  file_base64: z.string().min(1).max(10_000_000),
});

export const uploadPaymentProof = createServerFn({ method: "POST" })
  .inputValidator(uploadSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("payments").select("id").eq("public_token", data.token).maybeSingle();
    if (!p) return { ok: false as const, error: "Invalid token" };

    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];
    if (!allowed.includes(data.content_type)) return { ok: false as const, error: "Unsupported file type" };

    const ext = (data.filename.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
    const path = `${data.token}/${Date.now()}.${ext}`;
    const bytes = Buffer.from(data.file_base64, "base64");
    if (bytes.length > 7 * 1024 * 1024) return { ok: false as const, error: "File too large" };

    const { error } = await supabaseAdmin.storage.from("payment-proofs")
      .upload(path, bytes, { upsert: false, contentType: data.content_type });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, path };
  });

const tokenSchema = z.object({ token: z.string().min(8).max(128).regex(/^[a-f0-9]+$/i) });

export const getPaymentByToken = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("payments")
      .select("id,amount,status,type,due_date,booking_id,lead_id,company_id,proof_url,proof_uploaded_at")
      .eq("public_token", data.token)
      .is("deleted_at", null)
      .maybeSingle();
    if (!p) return { payment: null, lead: null, company: null };
    const [{ data: l }, { data: c }] = await Promise.all([
      supabaseAdmin.from("leads").select("id,full_name,assigned_to").eq("id", p.lead_id).maybeSingle(),
      supabaseAdmin.from("companies").select("id,name,logo_url,upi_id,bank_account,ifsc,wa_number").eq("id", p.company_id).maybeSingle(),
    ]);
    return { payment: p, lead: l, company: c };
  });

const submitSchema = z.object({
  token: z.string().min(8).max(128).regex(/^[a-f0-9]+$/i),
  file_path: z.string().min(1).max(500),
  payer_name: z.string().max(200).optional(),
  note: z.string().max(1000).optional(),
  transaction_reference: z.string().max(200).optional(),
});

export const submitPaymentProof = createServerFn({ method: "POST" })
  .inputValidator(submitSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("payments")
      .select("id,lead_id,amount,proof_url")
      .eq("public_token", data.token)
      .maybeSingle();
    if (!p) return { ok: false, error: "Not found" };

    await supabaseAdmin.from("payments").update({
      proof_url: data.file_path,
      proof_uploaded_at: new Date().toISOString(),
      proof_payer_name: data.payer_name ?? null,
      proof_note: data.note ?? null,
      transaction_reference: data.transaction_reference ?? null,
    }).eq("id", p.id);

    await supabaseAdmin.from("activity_logs").insert({
      lead_id: p.lead_id,
      action: `Client uploaded payment proof (${data.payer_name ?? "no name"})`,
      action_type: "system",
      metadata: { payment_id: p.id, file_path: data.file_path },
    });

    const { data: lead } = await supabaseAdmin
      .from("leads").select("assigned_to,full_name").eq("id", p.lead_id).maybeSingle();
    if (lead?.assigned_to) {
      await supabaseAdmin.from("notifications").insert({
        user_id: lead.assigned_to,
        title: "Payment proof received",
        body: `${lead.full_name} uploaded a payment screenshot — review it`,
        type: "system",
        lead_id: p.lead_id,
      });
    }
    return { ok: true };
  });
