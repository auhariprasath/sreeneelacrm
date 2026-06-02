import { supabase } from "@/integrations/supabase/client";

const DEFAULT_TEMPLATE =
  "✅ Task completed — [task_title]\n" +
  "Completed by: [staff_name]\n" +
  "Client: [client_name]\n" +
  "Event: [event_type] on [event_date]";

function applyTokens(template: string, tokens: Record<string, string>): string {
  return Object.entries(tokens).reduce(
    (s, [k, v]) => s.replaceAll(`[${k}]`, v ?? ""),
    template,
  );
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export async function notifyTaskCompleted(args: {
  taskId: string;
  companyId: string;
  completedByUserId: string;
}): Promise<{ error: string | null }> {
  const { data: task } = await supabase
    .from("tasks")
    .select("id, title, booking_id, company_id")
    .eq("id", args.taskId)
    .maybeSingle();
  if (!task) return { error: "Task not found" };

  const [
    { data: staff },
    { data: booking },
    { data: company },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", args.completedByUserId).maybeSingle(),
    task.booking_id
      ? supabase
          .from("bookings")
          .select("lead_id, event_date, requirement_id")
          .eq("id", task.booking_id)
          .maybeSingle()
      : Promise.resolve({ data: null as any }),
    supabase
      .from("companies")
      .select("wa_template_task_completed")
      .eq("id", args.companyId)
      .maybeSingle(),
  ]);

  const [{ data: lead }, { data: requirement }] = await Promise.all([
    booking?.lead_id
      ? supabase.from("leads").select("full_name").eq("id", booking.lead_id).maybeSingle()
      : Promise.resolve({ data: null as any }),
    booking?.requirement_id
      ? supabase
          .from("requirements")
          .select("event_type")
          .eq("id", booking.requirement_id)
          .maybeSingle()
      : Promise.resolve({ data: null as any }),
  ]);

  const template = company?.wa_template_task_completed?.trim() || DEFAULT_TEMPLATE;
  const message = applyTokens(template, {
    task_title: task.title ?? "",
    staff_name: staff?.full_name ?? "Staff",
    client_name: lead?.full_name ?? "—",
    event_type: requirement?.event_type ?? "—",
    event_date: fmtDate(booking?.event_date ?? null),
  });

  // Notify company admins
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("company_id", args.companyId)
    .eq("is_active", true)
    .is("deleted_at", null);
  const profileIds = (profiles ?? []).map((p) => p.id);
  let adminIds: string[] = [];
  if (profileIds.length) {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .in("user_id", profileIds);
    adminIds = (roles ?? []).map((r) => r.user_id);
  }

  if (adminIds.length) {
    await supabase.from("notifications").insert(
      adminIds.map((uid) => ({
        user_id: uid,
        type: "event_reminder" as const,
        title: `Task completed: ${task.title}`,
        body: message,
      })),
    );
  }

  // Activity log on the lead
  if (booking?.lead_id) {
    await supabase.from("activity_logs").insert({
      lead_id: booking.lead_id,
      action_type: "system",
      action: `Task completed: ${task.title}`,
      note: message,
      performed_by: args.completedByUserId,
      metadata: { task_id: task.id, booking_id: task.booking_id, channel: "in_app" },
    });
  }

  return { error: null };
}
