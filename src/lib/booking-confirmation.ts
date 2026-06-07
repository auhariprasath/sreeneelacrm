import { supabase } from "@/integrations/supabase/client";
import { formatINR, formatDateIN, formatTimeOfDay } from "@/lib/format";
import { buildWaMeLink } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];
type Requirement = Database["public"]["Tables"]["requirements"]["Row"];
type AddOn = Database["public"]["Tables"]["add_ons_selected"]["Row"];

export interface BookingConfirmationContext {
  booking: Booking;
  lead: Lead;
  company: Company;
  requirement: Requirement | null;
  addOns: AddOn[];
}

const DEFAULT_TEMPLATE = `🎉 Booking confirmed — [event_type]

Hello [client_name],

Your booking with [company_name] is confirmed. Here are the details:

📅 Date: [event_date]
🕒 Time: [start_time] – [end_time]
📍 Venue: [venue_address]
👥 Guests: [guest_count]
💰 Total: [total_amount]
✅ Paid: [amount_paid]
💳 Balance: [balance_amount]

[reminders]

[closing_line]

— [company_name]`;

function applyTokens(template: string, tokens: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(tokens)) {
    out = out.replaceAll(`[${k}]`, v);
  }
  return out;
}

export function buildConfirmationMessage(ctx: BookingConfirmationContext, invoiceUrl?: string | null): string {
  const { booking, lead, company, requirement, addOns } = ctx;
  const template = company.wa_template_booking_confirmed?.trim() || DEFAULT_TEMPLATE;

  const reminderLines = Array.isArray(company.confirmation_reminder_lines)
    ? (company.confirmation_reminder_lines as unknown as string[])
    : [];
  const closingLine = company.confirmation_closing_line ?? "";

  const addOnLines = addOns.length
    ? "\nAdd-ons:\n" + addOns.map((a) => `• ${a.addon_name}`).join("\n")
    : "";
  const invoiceLine = invoiceUrl ? `\n\n📄 Download invoice: ${invoiceUrl}` : "";

  const tokens: Record<string, string> = {
    client_name: lead.full_name,
    company_name: company.name,
    event_type: requirement?.event_type || "your event",
    event_date: booking.event_date ? formatDateIN(booking.event_date) : "TBD",
    start_time: booking.start_time ? formatTimeOfDay(booking.start_time) : "TBD",
    end_time: booking.end_time ? formatTimeOfDay(booking.end_time) : "TBD",
    guest_count: requirement?.guest_count ? String(requirement.guest_count) : "—",
    venue_address: booking.venue || company.full_address || "—",
    total_amount: formatINR(Number(booking.total_amount)),
    amount_paid: formatINR(Number(booking.amount_paid)),
    balance_amount: formatINR(Number(booking.balance_due)),
    reminders: reminderLines.length
      ? "📌 Please note:\n" + reminderLines.map((l) => `• ${applyTokens(l, { event_type: requirement?.event_type || "your event" })}`).join("\n")
      : "",
    closing_line: applyTokens(closingLine, { event_type: requirement?.event_type || "your event" }),
  };

  return applyTokens(template, tokens) + addOnLines + invoiceLine;
}

export async function loadBookingConfirmationContext(
  bookingId: string,
): Promise<BookingConfirmationContext | null> {
  const { data: booking } = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (!booking) return null;
  const [{ data: lead }, { data: company }, { data: requirement }] = await Promise.all([
    supabase.from("leads").select("*").eq("id", booking.lead_id).maybeSingle(),
    supabase.from("companies").select("*").eq("id", booking.company_id).maybeSingle(),
    supabase.from("requirements").select("*").eq("id", booking.requirement_id).maybeSingle(),
  ]);
  if (!lead || !company) return null;
  const { data: addOns } = await supabase.from("add_ons_selected")
    .select("*").eq("requirement_id", booking.requirement_id);
  return {
    booking: booking as Booking,
    lead: lead as Lead,
    company: company as Company,
    requirement: (requirement as Requirement) ?? null,
    addOns: (addOns ?? []) as AddOn[],
  };
}

/** Look up the public invoice URL for this booking's quotation (if invoice was generated). */
export async function loadInvoiceUrlForBooking(bookingId: string): Promise<string | null> {
  const { data: b } = await supabase.from("bookings").select("quotation_id").eq("id", bookingId).maybeSingle();
  if (!b?.quotation_id) return null;
  const { data: q } = await supabase
    .from("quotations")
    .select("public_token,invoice_generated_at")
    .eq("id", b.quotation_id)
    .maybeSingle();
  if (!q?.public_token || !q.invoice_generated_at) return null;
  if (typeof window === "undefined") return null;
  return `${window.location.origin}/invoice/${q.public_token}`;
}

export interface SendConfirmationArgs {
  ctx: BookingConfirmationContext;
  message: string;
  performedBy?: string | null;
}

export async function markConfirmationSent({ ctx, message, performedBy }: SendConfirmationArgs) {
  const now = new Date().toISOString();
  await supabase.from("bookings")
    .update({ confirmation_sent_at: now, confirmation_sent_by: performedBy ?? null })
    .eq("id", ctx.booking.id);

  await supabase.from("activity_logs").insert({
    lead_id: ctx.lead.id,
    action: "Booking confirmation sent to client",
    note: message.slice(0, 1000),
    action_type: "system",
    performed_by: performedBy ?? null,
    metadata: { booking_id: ctx.booking.id, channel: "whatsapp" },
  });
}

export function buildWaLink(phone: string, message: string): string {
  return buildWaMeLink(phone, message) ?? "";
}
