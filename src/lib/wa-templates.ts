export type WaTemplateCategory =
  | "lead_capture"
  | "follow_up"
  | "quotation"
  | "booking_payment"
  | "event_reminders"
  | "post_event"
  | "meetings"
  | "tasks_coordination";

export interface WaTemplateDef {
  key: string;
  name: string;
  fires: string;
  category: WaTemplateCategory;
  defaultBody: string;
}

export const CATEGORY_LABELS: Record<WaTemplateCategory, string> = {
  lead_capture: "Lead capture",
  follow_up: "Follow-up sequence",
  quotation: "Quotation",
  booking_payment: "Booking and payment",
  event_reminders: "Event reminders",
  post_event: "Post-event",
  meetings: "Meetings",
  tasks_coordination: "Tasks and coordination",
};

export const PLACEHOLDERS: string[] = [
  "Name", "Company", "Event type", "Event date", "Start time", "End time",
  "Guest count", "Amount", "Balance", "Staff name", "Staff phone",
  "PDF link", "Quote link", "Invoice link", "Booking ref", "Invoice number",
  "Feedback link", "Google review link", "Address", "Maps link",
  "Portfolio link", "Video link", "Contact person", "Contact phone", "Coordinator name",
  "Upload link", "Progress link", "Approval link",
  "Meeting date", "Meeting time", "Duration",
];

export const WA_TEMPLATES: WaTemplateDef[] = [
  // Lead capture
  { key: "lead_ack", name: "New lead acknowledgement", fires: "Within 5 min of lead creation", category: "lead_capture",
    defaultBody: "Hi [Name], thanks for reaching out to [Company]! We've received your enquiry and will get back to you shortly." },
  { key: "no_answer_followup", name: "No answer follow-up", fires: "After first call no answer", category: "lead_capture",
    defaultBody: "Hi [Name], we tried calling you regarding your enquiry with [Company]. Please share a convenient time to talk." },
  { key: "requirements_confirmed", name: "Requirements confirmed", fires: "After intake saved (includes photos, maps)", category: "lead_capture",
    defaultBody: "Hi [Name], your requirements for [Event type] on [Event date] are saved. Venue: [Address] ([Maps link])." },

  // Follow-up
  { key: "day1_followup", name: "Day 1 follow-up", fires: "24 hours no response", category: "follow_up",
    defaultBody: "Hi [Name], just checking in on your enquiry for [Event type]. Happy to answer any questions!" },
  { key: "day3_followup", name: "Day 3 follow-up", fires: "72 hours no response", category: "follow_up",
    defaultBody: "Hi [Name], following up again on your [Event type] enquiry. Would love to help you plan this." },
  { key: "day5_portfolio", name: "Day 5 portfolio", fires: "5 days — includes portfolio link and photos", category: "follow_up",
    defaultBody: "Hi [Name], sharing our portfolio so you can see our recent work: [Portfolio link]" },

  // Quotation
  { key: "quotation_sent", name: "Quotation sent", fires: "On send — includes quote link", category: "quotation",
    defaultBody: "Hi [Name], your quotation from [Company] for [Event type] on [Event date] is ready: [Quote link]. Total: [Amount]." },
  { key: "quotation_followup", name: "Quotation follow-up", fires: "48 hours after sending, no reply", category: "quotation",
    defaultBody: "Hi [Name], following up on the quotation we shared: [Quote link]. Let us know your thoughts!" },
  { key: "quotation_viewed_staff", name: "Quotation viewed notification", fires: "To staff when client opens link", category: "quotation",
    defaultBody: "[Name] just viewed the quotation. Good time to follow up." },
  { key: "quotation_revised", name: "Revised quotation", fires: "On revision — includes new quote link", category: "quotation",
    defaultBody: "Hi [Name], we've revised your quotation as discussed: [Quote link]. New total: [Amount]." },
  { key: "quotation_expired", name: "Quotation expired", fires: "After 7 days no response", category: "quotation",
    defaultBody: "Hi [Name], your quotation has expired. We would love to prepare a fresh one for you!" },

  // Booking and payment
  { key: "booking_confirmed", name: "Booking confirmed", fires: "After payment — includes booking ref", category: "booking_payment",
    defaultBody: "Hi [Name], your booking [Booking ref] for [Event type] on [Event date] is confirmed. Thank you!" },
  { key: "advance_receipt", name: "Advance payment receipt", fires: "Payment logged", category: "booking_payment",
    defaultBody: "Hi [Name], we've received [Amount] toward your booking [Booking ref]. Balance due: [Balance]." },
  { key: "invoice_sent", name: "Invoice sent", fires: "On invoice generation — includes upload link", category: "booking_payment",
    defaultBody: "Hi [Name], your invoice [Invoice number] is ready: [Invoice link]. Upload payment proof here: [Upload link]." },
  { key: "balance_reminder", name: "Balance payment reminder", fires: "7 days before event if balance due", category: "booking_payment",
    defaultBody: "Hi [Name], a reminder that [Balance] is due before your event on [Event date]." },
  { key: "payment_screenshot_staff", name: "Payment screenshot received", fires: "To staff — internal notification", category: "booking_payment",
    defaultBody: "[Name] uploaded a payment screenshot for booking [Booking ref]. Please review." },
  { key: "payment_approved_client", name: "Payment approved confirmation", fires: "To client after screenshot approved", category: "booking_payment",
    defaultBody: "Hi [Name], your payment of [Amount] has been approved. Thank you!" },

  // Event reminders
  { key: "reminder_48h", name: "48-hour event reminder", fires: "To lead", category: "event_reminders",
    defaultBody: "Hi [Name], your [Event type] is in 2 days on [Event date] at [Start time]. Venue: [Address]." },
  { key: "reminder_24h", name: "24-hour event reminder", fires: "To lead", category: "event_reminders",
    defaultBody: "Hi [Name], your [Event type] is tomorrow at [Start time]. See you at [Address] ([Maps link])." },
  { key: "event_completed", name: "Event completed thank you", fires: "On event marked done", category: "event_reminders",
    defaultBody: "Hi [Name], thank you for choosing [Company] for your [Event type]! It was a pleasure." },

  // Post-event
  { key: "feedback_request", name: "Feedback request", fires: "2 days after — includes feedback + Google link", category: "post_event",
    defaultBody: "Hi [Name], we'd love your feedback: [Feedback link]. A Google review would mean a lot: [Google review link]." },
  { key: "reengage_30", name: "Re-engagement 30 days", fires: "30 days after event", category: "post_event",
    defaultBody: "Hi [Name], hope you're doing well! Any upcoming events we can help with?" },
  { key: "reengage_90", name: "Re-engagement 90 days", fires: "90 days after event", category: "post_event",
    defaultBody: "Hi [Name], it's been a few months since your last event. We'd love to plan the next one with you!" },
  { key: "reengage_180", name: "Re-engagement 180 days", fires: "180 days after event", category: "post_event",
    defaultBody: "Hi [Name], staying in touch from [Company]. Let us know whenever you're planning your next event!" },

  // Meetings
  { key: "meeting_confirmed", name: "Schedule venue meeting", fires: "Sent when venue meeting is scheduled", category: "meetings",
    defaultBody: "Hello [Name]! 🙏\n\nThank you for your interest in *[Company]*.\nWe are pleased to invite you for a venue visit.\n\n*Visit Details*\n📅 Date: [Meeting date]\n⏰ Time: [Meeting time]\n⏳ Duration: ~[Duration] min\n\n*Venue*\n🏛 [Company]\n📍 [Address]\n🗺 Directions: [Maps link]\n\n*Your Point of Contact*\n👤 [Contact person]\n📞 [Contact phone]\n\nWe look forward to welcoming you.\nPlease confirm your visit by replying *YES* or call us if you need to reschedule." },
  { key: "meeting_reminder_1d", name: "Meeting reminder 1 day before", fires: "To lead", category: "meetings",
    defaultBody: "Hi [Name], reminder about our meeting tomorrow at [Start time]. Address: [Address] ([Maps link])." },
  { key: "meeting_reminder_now", name: "Meeting reminder at meeting time", fires: "To lead", category: "meetings",
    defaultBody: "Hi [Name], we're ready for our meeting at [Address]. See you soon!" },

  // Tasks and coordination
  { key: "task_assigned_staff", name: "Task assigned", fires: "To staff — includes reply options 1 2 3 4", category: "tasks_coordination",
    defaultBody: "New task assigned: [Booking ref]. Reply 1=Accept, 2=Done, 3=Need help, 4=Reassign." },
  { key: "coordinator_assigned", name: "Coordinator assigned", fires: "To coordinator — includes coordination link", category: "tasks_coordination",
    defaultBody: "Hi [Coordinator name], you've been assigned to [Name]'s event on [Event date]. Details: [Progress link]." },
  { key: "event_progress_update", name: "Event progress update", fires: "To lead — includes progress link", category: "tasks_coordination",
    defaultBody: "Hi [Name], here is the latest progress on your event: [Progress link]." },
];

export interface WaTemplateValue {
  body: string;
  autoSend: boolean;
}

export type WaTemplatesMap = Record<string, WaTemplateValue>;

export const SAMPLE_VALUES: Record<string, string> = {
  Name: "Priya Sharma",
  Company: "Sreeneela Events",
  "Event type": "Wedding reception",
  "Event date": "12 Aug 2026",
  "Start time": "6:00 PM",
  "End time": "11:00 PM",
  "Guest count": "250",
  Amount: "₹1,50,000",
  Balance: "₹75,000",
  "Staff name": "Anil Kumar",
  "Staff phone": "+91 98765 43210",
  "PDF link": "https://example.com/doc.pdf",
  "Quote link": "https://example.com/q/abc",
  "Invoice link": "https://example.com/i/abc",
  "Booking ref": "BKG-2026-0042",
  "Invoice number": "INV-2026-0042",
  "Feedback link": "https://example.com/f/abc",
  "Google review link": "https://g.page/r/abc/review",
  Address: "12 MG Road, Bengaluru",
  "Maps link": "https://maps.google.com/?q=12+MG+Road",
  "Portfolio link": "https://example.com/portfolio",
  "Video link": "https://example.com/video",
  "Contact person": "Priya Sharma",
  "Coordinator name": "Ravi Menon",
  "Upload link": "https://example.com/upload/abc",
  "Progress link": "https://example.com/progress/abc",
  "Approval link": "https://example.com/approve/abc",
  "Meeting date": "15 Aug 2026",
  "Meeting time": "11:00 AM",
  "Duration": "60",
  "Contact phone": "+91 98765 43210",
};

export function renderPreview(body: string): string {
  return body.replace(/\[([^\]]+)\]/g, (_m, key) => SAMPLE_VALUES[key] ?? `[${key}]`);
}
