import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type TaskOffsetKey =
  | "7d_before"
  | "3d_before"
  | "2d_before"
  | "1d_before"
  | "4h_before"
  | "day_of"
  | "custom";

export interface TaskTemplate {
  id?: string;
  title: string;
  description?: string;
  when: TaskOffsetKey;
  custom_hours?: number; // negative = before, used when when === "custom"
  assigned_to?: string | null;
  priority?: "low" | "medium" | "high";
}

export const OFFSET_OPTIONS: { value: TaskOffsetKey; label: string }[] = [
  { value: "7d_before", label: "7 days before event" },
  { value: "3d_before", label: "3 days before event" },
  { value: "2d_before", label: "2 days before event" },
  { value: "1d_before", label: "1 day before event" },
  { value: "4h_before", label: "4 hours before event" },
  { value: "day_of", label: "Day of event (at start time)" },
  { value: "custom", label: "Custom (hours before event)" },
];

/** Compute task due timestamp from event date/start_time and offset key */
export function computeDueAt(
  eventDate: string,
  startTime: string | null,
  tpl: TaskTemplate
): Date {
  const [y, m, d] = eventDate.split("-").map(Number);
  const [sh, sm] = (startTime ?? "10:00").split(":").map(Number);
  const eventStart = new Date(y, (m ?? 1) - 1, d ?? 1, sh ?? 10, sm ?? 0, 0, 0);
  const at10AM = (offsetDays: number) => new Date(y, (m ?? 1) - 1, (d ?? 1) - offsetDays, 10, 0, 0, 0);

  switch (tpl.when) {
    case "7d_before": return at10AM(7);
    case "3d_before": return at10AM(3);
    case "2d_before": return at10AM(2);
    case "1d_before": return at10AM(1);
    case "4h_before": return new Date(eventStart.getTime() - 4 * 3600_000);
    case "day_of": return eventStart;
    case "custom": return new Date(eventStart.getTime() - (tpl.custom_hours ?? 24) * 3600_000);
  }
}

/**
 * Generate tasks for a booking from the company's task templates.
 * Returns number of tasks created.
 */
export async function generateTasksForBooking(args: {
  bookingId: string;
  companyId: string;
  eventDate: string;
  startTime: string | null;
  createdBy: string | null;
}): Promise<number> {
  const { data: company } = await supabase
    .from("companies").select("task_templates").eq("id", args.companyId).maybeSingle();
  const templates = ((company?.task_templates as unknown) ?? []) as TaskTemplate[];
  if (!Array.isArray(templates) || templates.length === 0) return 0;

  // Skip if tasks already exist for this booking (idempotent)
  const { count } = await supabase
    .from("tasks").select("*", { count: "exact", head: true })
    .eq("booking_id", args.bookingId).is("deleted_at", null);
  if ((count ?? 0) > 0) return 0;

  const rows: Database["public"]["Tables"]["tasks"]["Insert"][] = templates
    .filter((t) => t && t.title?.trim())
    .map((t) => ({
      booking_id: args.bookingId,
      company_id: args.companyId,
      title: t.title.trim(),
      description: t.description ?? null,
      assigned_to: t.assigned_to ?? null,
      priority: t.priority ?? "medium",
      due_at: computeDueAt(args.eventDate, args.startTime, t).toISOString(),
      is_from_template: true,
      created_by: args.createdBy,
    }));
  if (!rows.length) return 0;
  const { error } = await supabase.from("tasks").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

/** Cancel/restore pre-event reminders & tasks when booking reschedules/cancels */
export async function regenerateTasksOnReschedule(args: {
  bookingId: string;
  companyId: string;
  newEventDate: string;
  newStartTime: string | null;
  createdBy: string | null;
}) {
  // Soft-delete existing pending tasks and regenerate
  await supabase.from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("booking_id", args.bookingId)
    .eq("is_from_template", true)
    .in("status", ["pending", "in_progress", "overdue"])
    .is("deleted_at", null);
  await generateTasksForBooking({
    bookingId: args.bookingId,
    companyId: args.companyId,
    eventDate: args.newEventDate,
    startTime: args.newStartTime,
    createdBy: args.createdBy,
  });
}
