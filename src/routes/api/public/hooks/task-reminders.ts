import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// 3-stage cascade for tasks:
//  - on-create  : fires once shortly after creation (within first run)
//  - T-2d-9am   : fires when "today 09:00 IST" matches the day that is 2 days before due
//  - at-due     : fires when due_at has been reached (and not done)
// Idempotency: tag `[task-reminder:<taskId>:<stage>]` in notification body.

type Stage = "on_create" | "t_minus_2d" | "at_due";

function fmtIN(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
}

export const Route = createFileRoute("/api/public/hooks/task-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const sb = supabaseAdmin;
        const now = new Date();

        const horizon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const { data: tasks, error } = await sb
          .from("tasks")
          .select("id, company_id, booking_id, title, description, assigned_to, due_at, status, created_at, created_by")
          .is("deleted_at", null)
          .neq("status", "done")
          .lte("due_at", horizon.toISOString());
        if (error) return Response.json({ error: error.message }, { status: 500 });

        let created = 0;
        const summaries: any[] = [];

        for (const t of tasks ?? []) {
          const dueMs = new Date(t.due_at).getTime();
          const createdMs = new Date(t.created_at).getTime();
          const msSinceCreate = now.getTime() - createdMs;
          const msUntilDue = dueMs - now.getTime();

          // Recipients = assignee + booking creator (admin/owner)
          const recipientIds = new Set<string>();
          if (t.assigned_to) recipientIds.add(t.assigned_to);
          if (t.created_by) recipientIds.add(t.created_by);

          const fireStage = async (stage: Stage, title: string, body: string) => {
            const tag = `[task-reminder:${t.id}:${stage}]`;
            const { data: existing } = await sb
              .from("notifications")
              .select("id")
              .ilike("body", `%${tag}%`)
              .limit(1)
              .maybeSingle();
            if (existing) return;
            for (const uid of recipientIds) {
              const { error: insErr } = await sb.from("notifications").insert({
                user_id: uid,
                title,
                body: `${body} ${tag}`,
                type: "event_reminder",
              });
              if (!insErr) created++;
            }
            summaries.push({ task: t.id, stage, recipients: recipientIds.size });
          };

          // Stage 1: on_create — within 15 min of creation
          if (msSinceCreate <= 15 * 60 * 1000) {
            await fireStage(
              "on_create",
              "New task assigned",
              `${t.title} — due ${fmtIN(t.due_at)}`,
            );
          }

          // Stage 2: T-2d at ~09:00 IST. Fire when due is 36h-60h away AND now is 08:55-10:00 IST.
          const istHour = Number(
            new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(now),
          );
          if (msUntilDue > 36 * 3600 * 1000 && msUntilDue <= 60 * 3600 * 1000 && istHour === 9) {
            await fireStage(
              "t_minus_2d",
              "Task due in 2 days",
              `${t.title} — due ${fmtIN(t.due_at)}`,
            );
          }

          // Stage 3: at_due — once due_at passed, before marked done
          if (msUntilDue <= 0 && msUntilDue > -24 * 3600 * 1000) {
            await fireStage(
              "at_due",
              "Task is due now",
              `${t.title} — was due ${fmtIN(t.due_at)}`,
            );
          }
        }

        return Response.json({
          ok: true,
          scanned: tasks?.length ?? 0,
          notifications_created: created,
          summaries,
          ran_at: now.toISOString(),
        });
      },
    },
  },
});
