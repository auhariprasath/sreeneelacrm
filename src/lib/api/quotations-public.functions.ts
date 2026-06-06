import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(8).max(128).regex(/^[a-f0-9]+$/i) });

export const getQuotationByToken = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: q } = await supabaseAdmin
      .from("quotations")
      .select("*")
      .eq("public_token", data.token)
      .is("deleted_at", null)
      .maybeSingle();
    if (!q) return { quote: null, lead: null, requirement: null, company: null };
    const [{ data: l }, { data: r }, { data: c }] = await Promise.all([
      supabaseAdmin.from("leads").select("id,full_name,phone").eq("id", q.lead_id).maybeSingle(),
      supabaseAdmin.from("requirements").select("id,event_type,event_date,start_time,end_time,guest_count").eq("id", q.requirement_id).maybeSingle(),
      supabaseAdmin.from("companies").select("id,name,logo_url,wa_number,email,address").eq("id", q.company_id).maybeSingle(),
    ]);
    return { quote: q, lead: l, requirement: r, company: c };
  });

export const markQuotationViewed = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: q } = await supabaseAdmin
      .from("quotations").select("id,lead_id,version,viewed_at,view_count,created_by").eq("public_token", data.token).maybeSingle();
    if (!q) return { ok: false };
    const isFirstView = !q.viewed_at;
    await supabaseAdmin.from("quotations").update({
      viewed_at: q.viewed_at ?? new Date().toISOString(),
      view_count: (q.view_count ?? 0) + 1,
    }).eq("id", q.id);
    await supabaseAdmin.from("activity_logs").insert({
      lead_id: q.lead_id,
      action: isFirstView ? `Quotation v${q.version} viewed by client` : `Quotation v${q.version} re-opened by client`,
      action_type: "system",
      metadata: { quotation_id: q.id, view_count: (q.view_count ?? 0) + 1 },
    });
    if (isFirstView && q.created_by) {
      await supabaseAdmin.from("notifications").insert({
        user_id: q.created_by,
        title: "Quotation viewed",
        body: `Client opened quotation v${q.version}`,
        type: "system",
        lead_id: q.lead_id,
      });
    }
    return { ok: true };
  });

export const approveQuotationByToken = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: q } = await supabaseAdmin
      .from("quotations").select("id,lead_id,version,status,created_by,total").eq("public_token", data.token).maybeSingle();
    if (!q) return { ok: false };
    if (q.status === "agreed") return { ok: true, already: true };
    const now = new Date().toISOString();
    await supabaseAdmin.from("quotations").update({
      status: "agreed", agreed_at: now, approved_at: now,
    }).eq("id", q.id);
    await supabaseAdmin.from("activity_logs").insert({
      lead_id: q.lead_id,
      action: `Client APPROVED quotation v${q.version} via public link`,
      action_type: "status_change",
      metadata: { quotation_id: q.id },
    });
    if (q.created_by) {
      await supabaseAdmin.from("notifications").insert({
        user_id: q.created_by,
        title: "Quotation approved",
        body: `Client approved quotation v${q.version} — ready to book`,
        type: "system",
        lead_id: q.lead_id,
      });
    }
    return { ok: true };
  });
