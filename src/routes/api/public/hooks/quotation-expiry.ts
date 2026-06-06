import { createFileRoute } from "@tanstack/react-router";

// Marks 7-day-old un-acted-on quotations as expired, notifies the staff member who
// created them, and logs a (placeholder) WhatsApp reminder for the client.
// Triggered by pg_cron once a day. No auth required — endpoint lives under /api/public.

export const Route = createFileRoute("/api/public/hooks/quotation-expiry")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();

        const { data: stale, error } = await supabaseAdmin
          .from("quotations")
          .select("id, lead_id, version, created_by, sent_at")
          .eq("status", "sent")
          .is("viewed_at", null)
          .is("agreed_at", null)
          .is("approved_at", null)
          .lt("sent_at", cutoff)
          .is("deleted_at", null);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
        if (!stale?.length) {
          return new Response(JSON.stringify({ ok: true, expired: 0 }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const ids = stale.map((q) => q.id);
        await supabaseAdmin.from("quotations").update({ status: "expired" }).in("id", ids);

        // Lookup client names for activity-log + WA reminder placeholder
        const leadIds = Array.from(new Set(stale.map((q) => q.lead_id)));
        const { data: leads } = await supabaseAdmin
          .from("leads").select("id, full_name, phone").in("id", leadIds);
        const leadMap = new Map((leads ?? []).map((l) => [l.id, l]));

        const activityRows = stale.map((q) => {
          const lead = leadMap.get(q.lead_id);
          return {
            lead_id: q.lead_id,
            action: `Quotation v${q.version} auto-expired (7 days, no response)`,
            action_type: "system" as const,
            metadata: {
              quotation_id: q.id,
              wa_reminder_sent_to: lead?.phone ?? null,
              wa_message: `Hi ${lead?.full_name ?? "there"}, your quotation has expired. We would love to prepare a fresh one for you!`,
            },
          };
        });
        await supabaseAdmin.from("activity_logs").insert(activityRows);

        const notifRows = stale
          .filter((q) => q.created_by)
          .map((q) => {
            const lead = leadMap.get(q.lead_id);
            return {
              user_id: q.created_by!,
              title: "Quotation expired",
              body: `Quotation v${q.version} for ${lead?.full_name ?? "client"} expired. Create new?`,
              type: "system" as const,
              lead_id: q.lead_id,
            };
          });
        if (notifRows.length) {
          await supabaseAdmin.from("notifications").insert(notifRows);
        }

        return new Response(JSON.stringify({ ok: true, expired: ids.length }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
