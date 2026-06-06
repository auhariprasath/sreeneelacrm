import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const idSchema = z.object({
  booking_id: z.string().uuid(),
});

export const getFeedbackBooking = createServerFn({ method: "POST" })
  .inputValidator(idSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id,lead_id,company_id,event_date,venue,deleted_at")
      .eq("id", data.booking_id)
      .maybeSingle();
    if (!booking || booking.deleted_at) return { booking: null, company_name: null, client_name: null };
    const [{ data: company }, { data: lead }] = await Promise.all([
      supabaseAdmin.from("companies").select("name").eq("id", booking.company_id).maybeSingle(),
      supabaseAdmin.from("leads").select("full_name").eq("id", booking.lead_id).maybeSingle(),
    ]);
    return {
      booking: {
        id: booking.id,
        lead_id: booking.lead_id,
        company_id: booking.company_id,
        event_date: booking.event_date,
        venue: booking.venue,
      },
      company_name: company?.name ?? null,
      client_name: lead?.full_name ?? null,
    };
  });

const submitSchema = z.object({
  booking_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator(submitSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id,lead_id,company_id,deleted_at")
      .eq("id", data.booking_id)
      .maybeSingle();
    if (!booking || booking.deleted_at) return { ok: false, error: "invalid_booking" as const };

    const { data: existing } = await supabaseAdmin
      .from("feedback").select("id").eq("booking_id", booking.id).maybeSingle();
    if (existing) return { ok: false, error: "already_submitted" as const };

    const comment = data.comment?.trim() || null;
    const { error } = await supabaseAdmin.from("feedback").insert({
      booking_id: booking.id,
      lead_id: booking.lead_id,
      company_id: booking.company_id,
      rating: data.rating,
      comment,
    });
    if (error) {
      if ((error as { code?: string }).code === "23505") return { ok: false, error: "already_submitted" as const };
      return { ok: false, error: error.message };
    }

    if (data.rating <= 3) {
      const { data: admins } = await supabaseAdmin
        .from("user_roles").select("user_id").in("role", ["super_admin", "admin"]);
      const rows = (admins ?? []).map((a) => ({
        user_id: a.user_id,
        type: "low_rating" as const,
        title: `Low rating: ${data.rating}★`,
        body: `Client rated ${data.rating}/5${comment ? ` — "${comment.slice(0, 80)}"` : ""}`,
        lead_id: booking.lead_id,
      }));
      if (rows.length > 0) await supabaseAdmin.from("notifications").insert(rows);
      await supabaseAdmin.from("activity_logs").insert({
        lead_id: booking.lead_id, action: "Low rating received", action_type: "system",
        note: `Client rated ${data.rating}/5${comment ? `: "${comment}"` : ""}`,
      });
    } else {
      await supabaseAdmin.from("activity_logs").insert({
        lead_id: booking.lead_id, action: "Feedback received", action_type: "system",
        note: `Client rated ${data.rating}/5${comment ? `: "${comment}"` : ""}`,
      });
    }

    return { ok: true as const };
  });
