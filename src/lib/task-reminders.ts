import { supabase } from "@/integrations/supabase/client";

export type ReminderMode = "absolute" | "before_event" | "before_due";
export type ReminderUnit = "hours" | "days";
export type ReminderRepeatFreq = "hourly" | "daily" | "every_2_days" | "custom";

export interface ReminderFormState {
  mode: ReminderMode;
  // absolute
  absoluteDate: string; // yyyy-mm-dd
  absoluteTime: string; // HH:mm
  // before_event / before_due
  offsetValue: number;
  offsetUnit: ReminderUnit;
  // repeat
  repeat: boolean;
  repeatFrequency: ReminderRepeatFreq;
  repeatIntervalHours: number;
  // recipients
  notifyAssignee: boolean;
  notifyAdmin: boolean;
  sendWa: boolean;
}

export const DEFAULT_REMINDER_FORM: ReminderFormState = {
  mode: "before_due",
  absoluteDate: "",
  absoluteTime: "09:00",
  offsetValue: 2,
  offsetUnit: "hours",
  repeat: false,
  repeatFrequency: "daily",
  repeatIntervalHours: 6,
  notifyAssignee: true,
  notifyAdmin: true,
  sendWa: false,
};

function msFor(value: number, unit: ReminderUnit): number {
  const mult = unit === "days" ? 24 * 3600 * 1000 : 3600 * 1000;
  return value * mult;
}

/** Compute the next-fire timestamp from a form state, given the task due date and the booking event date. */
export function computeScheduledAt(
  f: ReminderFormState,
  taskDueAtIso: string,
  bookingEventDate: string | null,
): Date | null {
  if (f.mode === "absolute") {
    if (!f.absoluteDate || !f.absoluteTime) return null;
    const dt = new Date(`${f.absoluteDate}T${f.absoluteTime}:00`);
    return isNaN(dt.getTime()) ? null : dt;
  }
  if (f.mode === "before_event") {
    if (!bookingEventDate) return null;
    // Anchor at start of event day; subtract offset
    const eventStart = new Date(`${bookingEventDate}T00:00:00`);
    return new Date(eventStart.getTime() - msFor(f.offsetValue, f.offsetUnit));
  }
  // before_due
  const due = new Date(taskDueAtIso);
  return new Date(due.getTime() - msFor(f.offsetValue, f.offsetUnit));
}

export function repeatIntervalHoursFor(f: ReminderFormState): number | null {
  if (!f.repeat) return null;
  switch (f.repeatFrequency) {
    case "hourly": return 1;
    case "daily": return 24;
    case "every_2_days": return 48;
    case "custom": return Math.max(1, Math.floor(f.repeatIntervalHours || 1));
  }
}

export interface SaveArgs {
  taskId: string;
  companyId: string;
  taskDueAtIso: string;
  bookingEventDate: string | null;
  createdBy: string | null;
  form: ReminderFormState;
  existingId?: string | null;
}

export async function saveReminder(args: SaveArgs): Promise<{ error: string | null; id?: string }> {
  const scheduled = computeScheduledAt(args.form, args.taskDueAtIso, args.bookingEventDate);
  if (!scheduled) return { error: "Please pick a valid reminder time" };
  if (scheduled.getTime() < Date.now() - 60_000) return { error: "Reminder time is in the past" };
  if (!args.form.notifyAssignee && !args.form.notifyAdmin) {
    return { error: "Pick at least one recipient" };
  }

  const repeatHours = repeatIntervalHoursFor(args.form);

  const row = {
    task_id: args.taskId,
    company_id: args.companyId,
    mode: args.form.mode,
    absolute_at: args.form.mode === "absolute" ? scheduled.toISOString() : null,
    offset_value: args.form.mode !== "absolute" ? args.form.offsetValue : null,
    offset_unit: args.form.mode !== "absolute" ? args.form.offsetUnit : null,
    repeat: args.form.repeat,
    repeat_frequency: args.form.repeat ? args.form.repeatFrequency : null,
    repeat_interval_hours: args.form.repeat && args.form.repeatFrequency === "custom" ? repeatHours : null,
    notify_assignee: args.form.notifyAssignee,
    notify_admin: args.form.notifyAdmin,
    send_wa: args.form.sendWa,
    scheduled_at: scheduled.toISOString(),
    next_fire_at: scheduled.toISOString(),
    is_active: true,
    cancelled_at: null,
    created_by: args.createdBy,
  };

  if (args.existingId) {
    const { error } = await supabase.from("task_reminders").update(row).eq("id", args.existingId);
    return { error: error?.message ?? null, id: args.existingId };
  }
  const { data, error } = await supabase.from("task_reminders").insert(row).select("id").maybeSingle();
  return { error: error?.message ?? null, id: data?.id };
}

export async function loadReminderForTask(taskId: string) {
  const { data, error } = await supabase
    .from("task_reminders")
    .select("*")
    .eq("task_id", taskId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { reminder: null, error: error.message };
  return { reminder: data, error: null };
}

export function reminderRowToForm(r: Record<string, any>): ReminderFormState {
  const sched = r.scheduled_at ? new Date(r.scheduled_at) : null;
  return {
    mode: (r.mode as ReminderMode) ?? "before_due",
    absoluteDate: sched ? sched.toISOString().slice(0, 10) : "",
    absoluteTime: sched ? sched.toTimeString().slice(0, 5) : "09:00",
    offsetValue: r.offset_value ?? 2,
    offsetUnit: (r.offset_unit as ReminderUnit) ?? "hours",
    repeat: !!r.repeat,
    repeatFrequency: (r.repeat_frequency as ReminderRepeatFreq) ?? "daily",
    repeatIntervalHours: r.repeat_interval_hours ?? 6,
    notifyAssignee: r.notify_assignee !== false,
    notifyAdmin: r.notify_admin !== false,
    sendWa: !!r.send_wa,
  };
}

export async function cancelReminder(id: string) {
  return supabase
    .from("task_reminders")
    .update({ is_active: false, cancelled_at: new Date().toISOString() })
    .eq("id", id);
}
