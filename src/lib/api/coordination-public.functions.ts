import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({
  token: z.string().min(8).max(128).regex(/^[a-zA-Z0-9_-]+$/),
});
const updateSchema = z.object({
  token: z.string().min(8).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  stage: z.enum([
    "coordinator_assigned",
    "requirements_reviewed",
    "preparations_started",
    "venue_ready",
    "event_started",
    "event_completed",
  ]),
});

async function loadByCoord(token: string, kind: "coordinator" | "client") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const col = kind === "coordinator" ? "coordinator_token" : "client_status_token";
  const { data: coord } = await supabaseAdmin
    .from("event_coordination" as any)
    .select("id,booking_id,company_id,coordinator_id,assigned_at")
    .eq(col, token)
    .maybeSingle();
  if (!coord) return { coord: null, booking: null, lead: null, company: null, coordinator: null, updates: [] };
  const c = coord as any;
  const [{ data: bk }, { data: ups }, { data: who }] = await Promise.all([
    supabaseAdmin.from("bookings").select("id,event_date,start_time,end_time,venue,company_id,lead_id,total_amount").eq("id", c.booking_id).maybeSingle(),
    supabaseAdmin.from("event_coordination_updates" as any).select("stage,updated_at,updated_by").eq("coordination_id", c.id).order("updated_at", { ascending: true }),
    supabaseAdmin.from("profiles").select("id,full_name,phone").eq("id", c.coordinator_id).maybeSingle(),
  ]);
  let lead: any = null;
  let company: any = null;
  if (bk) {
    const [{ data: l }, { data: co }] = await Promise.all([
      supabaseAdmin.from("leads").select("full_name,phone,event_type").eq("id", (bk as any).lead_id).maybeSingle(),
      supabaseAdmin.from("companies").select("name,meeting_contact_name,meeting_contact_phone").eq("id", (bk as any).company_id).maybeSingle(),
    ]);
    lead = l; company = co;
  }
  // Resolve update author names
  const ids = Array.from(new Set(((ups as any[]) ?? []).map((u) => u.updated_by).filter(Boolean)));
  let names: Record<string, string> = {};
  if (ids.length) {
    const { data: ps } = await supabaseAdmin.from("profiles").select("id,full_name").in("id", ids);
    ((ps as any[]) ?? []).forEach((p) => { names[p.id] = p.full_name; });
  }
  const updates = ((ups as any[]) ?? []).map((u) => ({ ...u, updated_by_name: u.updated_by ? names[u.updated_by] ?? null : null }));
  return { coord: c, booking: bk, lead, company, coordinator: who, updates };
}

export const getCoordinationByCoordinatorToken = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema)
  .handler(async ({ data }) => loadByCoord(data.token, "coordinator"));

export const getCoordinationByClientToken = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema)
  .handler(async ({ data }) => loadByCoord(data.token, "client"));

export const addCoordinationUpdate = createServerFn({ method: "POST" })
  .inputValidator(updateSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: coord } = await supabaseAdmin
      .from("event_coordination" as any)
      .select("id,booking_id,company_id,coordinator_id")
      .eq("coordinator_token", data.token)
      .maybeSingle();
    if (!coord) return { ok: false, error: "Invalid link" };
    const c = coord as any;
    const { error } = await supabaseAdmin.from("event_coordination_updates" as any).insert({
      coordination_id: c.id,
      booking_id: c.booking_id,
      company_id: c.company_id,
      stage: data.stage,
      updated_by: c.coordinator_id,
      updated_via: "tap_link",
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });
