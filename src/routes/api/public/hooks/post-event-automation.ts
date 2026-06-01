import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Scans completed bookings and creates owner notifications when
// the scheduled feedback-WA or re-engagement WA time has arrived.
// Idempotent via tag in notification body: [post-event:<id>:feedback|reengage]

function fmtIN(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export const Route = createFileRoute("/api/public/hooks/post-event-automation")({
  server: {
    handlers: {
      POST: async () => {
        const sb = supabaseAdmin;
        const now = new Date();
        const nowIso = now.toISOString();

        const { data: bookings, error } = await sb
          .from("bookings")
          .select("id, company_id, lead_id, event_date, created_by, feedback_wa_scheduled_at, feedback_wa_sent_at, reengagement_scheduled_at, reengagement_sent_at")
          .eq("status", "completed")
          .is("deleted_at", null);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        let created = 0;
        const summaries: any[] = [];

        for (const b of bookings ?? []) {
          const { data: lead } = await sb
            .from("leads").select("full_name, phone").eq("id", b.lead_id).maybeSingle();
          const leadName = lead?.full_name ?? "Client";

          // Find admin/owner recipients for the company
          const { data: admins } = await sb.from("user_roles").select("user_id").in("role", ["admin", "super_admin"]);
          const adminIds = (admins ?? []).map((a: any) => a.user_id);
          let recipientIds: string[] = [];
          if (adminIds.length) {
            const { data: profs } = await sb.from("profiles").select("id")
              .eq("company_id", b.company_id).in("id", adminIds);
            recipientIds = (profs ?? []).map((p: any) => p.id);
          }
          if (b.created_by && !recipientIds.includes(b.created_by)) recipientIds.push(b.created_by);

          // Feedback WA due
          if (b.feedback_wa_scheduled_at && !b.feedback_wa_sent_at && b.feedback_wa_scheduled_at <= nowIso) {
            const tag = `[post-event:${b.id}:feedback]`;
            const { data: ex } = await sb.from("notifications").select("id")
              .eq("lead_id", b.lead_id).ilike("body", `%${tag}%`).limit(1).maybeSingle();
            if (!ex) {
              for (const uid of recipientIds) {
                const { error: insErr } = await sb.from("notifications").insert({
                  user_id: uid, lead_id: b.lead_id,
                  title: "Send feedback request",
                  body: `${leadName} — event on ${fmtIN(b.event_date)}. Time to send feedback link via WhatsApp. ${tag}`,
                  type: "system",
                });
                if (!insErr) created++;
              }
              await sb.from("bookings").update({ feedback_wa_sent_at: nowIso }).eq("id", b.id);
              summaries.push({ booking: b.id, stage: "feedback", recipients: recipientIds.length });
            }
          }

          // Re-engagement WA due
          if (b.reengagement_scheduled_at && !b.reengagement_sent_at && b.reengagement_scheduled_at <= nowIso) {
            const tag = `[post-event:${b.id}:reengage]`;
            const { data: ex } = await sb.from("notifications").select("id")
              .eq("lead_id", b.lead_id).ilike("body", `%${tag}%`).limit(1).maybeSingle();
            if (!ex) {
              for (const uid of recipientIds) {
                const { error: insErr } = await sb.from("notifications").insert({
                  user_id: uid, lead_id: b.lead_id,
                  title: "Re-engagement opportunity",
                  body: `${leadName} — 30+ days since their event. Send anniversary / referral message. ${tag}`,
                  type: "system",
                });
                if (!insErr) created++;
              }
              await sb.from("bookings").update({ reengagement_sent_at: nowIso }).eq("id", b.id);
              summaries.push({ booking: b.id, stage: "reengage", recipients: recipientIds.length });
            }
          }
        }

        return Response.json({
          ok: true,
          scanned: bookings?.length ?? 0,
          notifications_created: created,
          summaries,
          ran_at: nowIso,
        });
      },
    },
  },
});
