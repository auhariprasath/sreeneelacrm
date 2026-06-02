import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Custom task reminders cron — runs frequently (every 5 min recommended).
// Fires any active reminder whose next_fire_at has passed,
// notifies selected recipients, then either advances next_fire_at (repeat)
// or deactivates the reminder.

function fmtIN(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short",
  });
}

export const Route = createFileRoute("/api/public/hooks/custom-task-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const sb = supabaseAdmin;
        const now = new Date();

        const { data: reminders, error } = await sb
          .from("task_reminders")
          .select("*")
          .eq("is_active", true)
          .lte("next_fire_at", now.toISOString())
          .limit(500);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        let fired = 0;
        const summaries: any[] = [];

        for (const r of reminders ?? []) {
          // Load task; skip if done/deleted
          const { data: task } = await sb
            .from("tasks")
            .select("id, title, status, due_at, assigned_to, created_by, booking_id, company_id, deleted_at")
            .eq("id", r.task_id)
            .maybeSingle();
          if (!task || task.deleted_at || task.status === "done") {
            await sb.from("task_reminders").update({
              is_active: false, cancelled_at: now.toISOString(),
            }).eq("id", r.id);
            continue;
          }

          const recipients = new Set<string>();
          if (r.notify_assignee && task.assigned_to) recipients.add(task.assigned_to);
          if (r.notify_admin) {
            if (task.created_by) recipients.add(task.created_by);
            // Also include company admins
            const { data: profs } = await sb
              .from("profiles").select("id").eq("company_id", task.company_id)
              .eq("is_active", true).is("deleted_at", null);
            const ids = (profs ?? []).map((p: any) => p.id);
            if (ids.length) {
              const { data: roles } = await sb
                .from("user_roles").select("user_id")
                .eq("role", "admin").in("user_id", ids);
              for (const x of roles ?? []) recipients.add(x.user_id);
            }
          }

          const tag = `[custom-task-reminder:${r.id}:${now.toISOString().slice(0, 16)}]`;
          const title = `🔔 Reminder: ${task.title}`;
          const body = `Due ${fmtIN(task.due_at)}. ${tag}`;

          if (recipients.size > 0) {
            await sb.from("notifications").insert(
              [...recipients].map((uid) => ({
                user_id: uid,
                type: "event_reminder" as const,
                title,
                body,
              })),
            );
            fired += recipients.size;
          }

          // Advance schedule or deactivate
          let nextFire: string | null = null;
          if (r.repeat) {
            const hours = r.repeat_frequency === "hourly" ? 1
              : r.repeat_frequency === "daily" ? 24
              : r.repeat_frequency === "every_2_days" ? 48
              : (r.repeat_interval_hours ?? 6);
            nextFire = new Date(now.getTime() + hours * 3600_000).toISOString();
          }

          await sb.from("task_reminders").update({
            last_fired_at: now.toISOString(),
            next_fire_at: nextFire,
            is_active: nextFire !== null,
          }).eq("id", r.id);

          summaries.push({ reminder: r.id, recipients: recipients.size, next: nextFire });
        }

        return Response.json({
          ok: true,
          scanned: reminders?.length ?? 0,
          notifications_fired: fired,
          summaries,
          ran_at: now.toISOString(),
        });
      },
    },
  },
});
