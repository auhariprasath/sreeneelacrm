import { supabase } from "@/integrations/supabase/client";

export interface TaskRequirementsContext {
  taskTitle: string;
  taskDescription: string | null;
  taskDueAt: string;
  assigneeName: string;
  assigneeId: string;
  assigneePhone: string | null;
  clientName: string;
  eventType: string;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  guestCount: number | null;
  venueName: string;
  addons: { name: string; price?: number }[];
  clientNotes: string | null;
}

/** Build a wa.me deep link for an Indian phone number (defaults +91). */
export function buildTaskWaLink(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const intl = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}


const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatDate(d: string): string {
  const dt = new Date(`${d}T00:00:00`);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function dayOfWeek(d: string): string {
  return DAYS[new Date(`${d}T00:00:00`).getDay()] ?? "";
}
function formatTime(t: string | null): string {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const hh = h ?? 0;
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}

export function buildRequirementsMessage(ctx: TaskRequirementsContext): string {
  const lines: string[] = [];
  lines.push(`📋 Task assigned to you — ${ctx.taskTitle}`);
  lines.push("");
  lines.push("Event details:");
  lines.push(`• Client: ${ctx.clientName}`);
  lines.push(`• Event: ${ctx.eventType || "—"}`);
  lines.push(`• Date: ${formatDate(ctx.eventDate)} (${dayOfWeek(ctx.eventDate)})`);
  lines.push(`• Time: ${formatTime(ctx.startTime)} – ${formatTime(ctx.endTime)}`);
  lines.push(`• Guests: ${ctx.guestCount ?? "—"}`);
  lines.push(`• Venue: ${ctx.venueName}`);
  lines.push("");
  lines.push("Your task:");
  lines.push(ctx.taskTitle);
  if (ctx.taskDescription) lines.push(ctx.taskDescription);
  lines.push(`Due by: ${formatDateTime(ctx.taskDueAt)}`);
  if (ctx.addons.length > 0) {
    lines.push("");
    lines.push("Add-ons and special requirements:");
    ctx.addons.forEach((a) => lines.push(`• ${a.name}`));
  }
  if (ctx.clientNotes) {
    lines.push("");
    lines.push("Client notes:");
    lines.push(ctx.clientNotes);
  }
  lines.push("");
  lines.push("Please reply: Noted · Started · Completed");
  return lines.join("\n");
}

/** Fetch all data needed to build the requirements message for a given task. */
export async function loadTaskRequirementsContext(taskId: string): Promise<TaskRequirementsContext | null> {
  const { data: task } = await supabase
    .from("tasks")
    .select("id, title, description, due_at, assigned_to, booking_id, company_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task || !task.assigned_to) return null;

  const [{ data: assignee }, { data: booking }, { data: company }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone").eq("id", task.assigned_to).maybeSingle(),
    supabase.from("bookings").select("id, lead_id, requirement_id, event_date, start_time, end_time, venue").eq("id", task.booking_id).maybeSingle(),
    supabase.from("companies").select("name").eq("id", task.company_id).maybeSingle(),
  ]);
  if (!booking) return null;

  const [{ data: lead }, { data: requirement }] = await Promise.all([
    supabase.from("leads").select("full_name").eq("id", booking.lead_id).maybeSingle(),
    supabase.from("requirements").select("event_type, guest_count, notes").eq("id", booking.requirement_id).maybeSingle(),
  ]);

  const { data: addons } = await supabase
    .from("add_ons_selected")
    .select("addon_name, addon_price")
    .eq("requirement_id", booking.requirement_id);

  return {
    taskTitle: task.title,
    taskDescription: task.description,
    taskDueAt: task.due_at,
    assigneeId: task.assigned_to,
    assigneeName: assignee?.full_name ?? "—",
    assigneePhone: assignee?.phone ?? null,
    clientName: lead?.full_name ?? "—",
    eventType: requirement?.event_type ?? "—",
    eventDate: booking.event_date,
    startTime: booking.start_time,
    endTime: booking.end_time,
    guestCount: requirement?.guest_count ?? null,
    venueName: booking.venue || company?.name || "—",
    addons: (addons ?? []).map((a) => ({ name: a.addon_name, price: Number(a.addon_price) || 0 })),
    clientNotes: requirement?.notes ?? null,
  };
}


/** Persist send: insert in-app notification, activity log, return ok. */
export async function sendTaskRequirements(args: {
  taskId: string;
  ctx: TaskRequirementsContext;
  message: string;
  bookingId: string;
  leadId: string;
  companyId: string;
  sentByUserId: string | null;
}): Promise<{ error: string | null }> {
  // 1. In-app notification to assignee
  const { error: nErr } = await supabase.from("notifications").insert({
    user_id: args.ctx.assigneeId,
    type: "event_reminder",
    title: `Task assigned: ${args.ctx.taskTitle}`,
    body: args.message,
  });
  if (nErr) return { error: nErr.message };

  // 2. Activity log on the lead
  const { error: aErr } = await supabase.from("activity_logs").insert({
    lead_id: args.leadId,
    action_type: "system",
    action: `Requirements sent to ${args.ctx.assigneeName} for task: ${args.ctx.taskTitle}`,
    note: null,
    performed_by: args.sentByUserId,
    metadata: { task_id: args.taskId, booking_id: args.bookingId },
  });
  if (aErr) return { error: aErr.message };

  return { error: null };
}
