import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Stage definitions: when, what, target
// tag format: [pre-event:<bookingId>:<stage>]
type Stage = {
  key: string;
  hoursBefore: number;
  title: (ctx: Ctx) => string;
  body: (ctx: Ctx) => string;
  target: "owner" | "company_admins" | "vendors";
};

type Ctx = {
  leadName: string;
  eventDateIN: string;
  startTime: string | null;
  venue: string | null;
};

const STAGES: Stage[] = [
  {
    key: "T-7d",
    hoursBefore: 24 * 7,
    target: "owner",
    title: () => "Event in 7 days",
    body: (c) => `${c.leadName} — ${c.eventDateIN}. Confirm vendors, finalise menu.`,
  },
  {
    key: "T-3d",
    hoursBefore: 24 * 3,
    target: "company_admins",
    title: () => "Event in 3 days",
    body: (c) => `${c.leadName} — ${c.eventDateIN}. Re-confirm all vendors & staff.`,
  },
  {
    key: "T-1d",
    hoursBefore: 24,
    target: "company_admins",
    title: () => "Event tomorrow",
    body: (c) => `${c.leadName} — ${c.eventDateIN}${c.startTime ? " at " + c.startTime.slice(0, 5) : ""}${c.venue ? " · " + c.venue : ""}.`,
  },
  {
    key: "T-4h",
    hoursBefore: 4,
    target: "company_admins",
    title: () => "Event in 4 hours",
    body: (c) => `${c.leadName} — final check. Crew dispatched? Vendors on-site?`,
  },
];

function fmtIN(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export const Route = createFileRoute("/api/public/hooks/pre-event-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const sb = supabaseAdmin;
        const now = new Date();
        // Look ahead up to 8 days
        const horizon = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
        const todayISO = now.toISOString().slice(0, 10);
        const horizonISO = horizon.toISOString().slice(0, 10);

        const { data: bookings, error } = await sb
          .from("bookings")
          .select("id, company_id, lead_id, event_date, start_time, venue, created_by, status")
          .gte("event_date", todayISO)
          .lte("event_date", horizonISO)
          .eq("status", "confirmed")
          .is("deleted_at", null);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        let created = 0;
        const summaries: any[] = [];

        for (const b of bookings ?? []) {
          // Compute event timestamp (use start_time or 18:00 fallback)
          const t = (b.start_time ?? "18:00:00").slice(0, 8);
          const eventTs = new Date(`${b.event_date}T${t}+05:30`);
          const msAway = eventTs.getTime() - now.getTime();
          if (msAway <= 0) continue;

          const { data: lead } = await sb
            .from("leads")
            .select("full_name")
            .eq("id", b.lead_id)
            .maybeSingle();
          const ctx: Ctx = {
            leadName: lead?.full_name ?? "Booking",
            eventDateIN: fmtIN(b.event_date),
            startTime: b.start_time,
            venue: b.venue,
          };

          for (const stage of STAGES) {
            const stageMs = stage.hoursBefore * 60 * 60 * 1000;
            // Fire when within (stageMs - 1h) and stageMs window has passed
            // i.e. msAway <= stageMs (we've crossed the threshold)
            if (msAway > stageMs) continue;

            const tag = `[pre-event:${b.id}:${stage.key}]`;
            // Idempotency: check existing
            const { data: existing } = await sb
              .from("notifications")
              .select("id")
              .eq("lead_id", b.lead_id)
              .ilike("body", `%${tag}%`)
              .limit(1)
              .maybeSingle();
            if (existing) continue;

            // Determine recipients
            let recipientIds: string[] = [];
            if (stage.target === "owner" && b.created_by) {
              recipientIds = [b.created_by];
            } else {
              const { data: admins } = await sb
                .from("user_roles")
                .select("user_id")
                .in("role", ["admin", "super_admin"]);
              const adminIds = (admins ?? []).map((a: any) => a.user_id);
              if (adminIds.length) {
                const { data: profs } = await sb
                  .from("profiles")
                  .select("id")
                  .eq("company_id", b.company_id)
                  .in("id", adminIds);
                recipientIds = (profs ?? []).map((p: any) => p.id);
              }
              if (b.created_by && !recipientIds.includes(b.created_by)) {
                recipientIds.push(b.created_by);
              }
            }

            for (const uid of recipientIds) {
              const { error: insErr } = await sb.from("notifications").insert({
                user_id: uid,
                lead_id: b.lead_id,
                title: stage.title(ctx),
                body: `${stage.body(ctx)} ${tag}`,
                type: "info",
              });
              if (!insErr) created++;
            }
            summaries.push({ booking: b.id, stage: stage.key, recipients: recipientIds.length });
          }
        }

        return Response.json({
          ok: true,
          scanned: bookings?.length ?? 0,
          notifications_created: created,
          summaries,
          ran_at: now.toISOString(),
        });
      },
    },
  },
});
