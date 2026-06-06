import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({
  token: z.string().min(8).max(128).regex(/^[a-zA-Z0-9_-]+$/),
});

const insertSchema = z.object({
  token: z.string().min(8).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  status: z.enum(["packed", "traveling", "arrived", "setup_done"]),
});

export const getVendorStatusByToken = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bv } = await supabaseAdmin
      .from("booking_vendors")
      .select("id,vendor_id,service_description,booking_id")
      .eq("status_token", data.token)
      .maybeSingle();
    if (!bv) return { bv: null, booking: null, vendor: null, company: null, updates: [] };
    const [{ data: bk }, { data: v }, { data: ups }] = await Promise.all([
      supabaseAdmin.from("bookings")
        .select("id,event_date,start_time,venue,company_id").eq("id", bv.booking_id).maybeSingle(),
      supabaseAdmin.from("vendors")
        .select("name,service_type").eq("id", bv.vendor_id).maybeSingle(),
      supabaseAdmin.from("vendor_status_updates")
        .select("status,updated_at,updated_via")
        .eq("booking_vendor_id", bv.id).order("updated_at", { ascending: true }),
    ]);
    let company = null;
    if (bk) {
      const { data: c } = await supabaseAdmin.from("companies")
        .select("name,meeting_contact_name,meeting_contact_phone")
        .eq("id", bk.company_id).maybeSingle();
      company = c;
    }
    return { bv, booking: bk, vendor: v, company, updates: ups ?? [] };
  });

export const addVendorStatusUpdate = createServerFn({ method: "POST" })
  .inputValidator(insertSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bv } = await supabaseAdmin
      .from("booking_vendors")
      .select("id,booking_id,vendor_id,company_id")
      .eq("status_token", data.token)
      .maybeSingle();
    if (!bv) return { ok: false, error: "Invalid token" };

    const { error } = await supabaseAdmin.from("vendor_status_updates").insert({
      booking_vendor_id: bv.id,
      booking_id: bv.booking_id,
      vendor_id: bv.vendor_id,
      company_id: bv.company_id,
      status: data.status,
      updated_via: "tap_link",
    } as any);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });
