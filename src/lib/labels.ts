/**
 * Plain-language labels (Phase 8 Change 1).
 * Replace all technical/professional labels with everyday wording.
 * Import from here instead of hard-coding strings in components.
 */
import type { Database } from "@/integrations/supabase/types";

type LeadStatus = Database["public"]["Enums"]["lead_status"];
type BookingStatus = Database["public"]["Enums"]["booking_status"];
type RequirementStatus = Database["public"]["Enums"]["requirement_status"];
type QuotationStatus = Database["public"]["Enums"]["quotation_status"];
type SlotStatus = Database["public"]["Enums"]["slot_status"];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New enquiry",
  in_progress: "Active",
  follow_up: "Follow-up",
  venue_meeting: "Venue meeting",
  positive: "Interested",
  neutral: "Thinking",
  negative: "Not interested",
  unresponsive: "No reply",
  closed: "Closed",
  locked: "Locked",
};

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: "Booking confirmed",
  cheque_pending: "Cheque not cleared",
  completed: "Event done",
  rescheduled: "Date changed",
  cancelled: "Booking cancelled",
  disputed: "Payment issue",
};

export const REQUIREMENT_STATUS_LABEL: Record<RequirementStatus, string> = {
  collecting: "Getting details",
  slot_checking: "Checking date",
  slot_confirmed: "Date held",
  muhurtham_conflict: "Muhurtham conflict",
  complete: "Details complete",
};

export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Quote sent",
  agreed: "Quote accepted",
  revised: "Being revised",
  declined: "Client said no",
  expired: "Expired",
};

export const SLOT_STATUS_LABEL: Record<SlotStatus, string> = {
  free: "Date available",
  soft_hold: "Date reserved",
  enquiry: "Multiple enquiries on this date",
  confirmed: "Date already booked",
};

/** Reusable plain-language phrases (use anywhere instead of jargon). */
export const TERMS = {
  quotationBuilder: "Prepare quote",
  proformaInvoice: "Invoice",
  smartReminder: "Auto payment reminder",
  activityLog: "Timeline",
  softHoldTimer: "Date hold timer",
  transferRequest: "Move to another venue",
  collectionOwner: "Main coordinator",
  winLossLog: "Outcome record",
  unresponsiveTag: "No reply tag",
  autoApprove: "Skip approval",
  followUp: "Call back",
  intakeForm: "Collect details",
  requirement: "Event details",
  vendorNoShow: "Vendor did not arrive",
  forceMajeure: "Emergency reschedule",
  flag: "Flag contact",
  flagged: "Flagged",
  removeFlag: "Remove flag",
} as const;

/** Tooltip explanations used by <InfoTip>. */
export const TOOLTIPS = {
  dateReserved:
    "This date is temporarily held for this enquiry for 30 minutes while they decide. If not confirmed, it will be released automatically.",
  multipleEnquiries:
    "More than one person is interested in this date. Whoever pays first gets it.",
  dateBooked:
    "This date is confirmed and paid by another client. You must pick a different date.",
  noReplyTag:
    "This lead did not respond after several call attempts. You must decide to drop them or try again.",
  dateHoldTimer:
    "You have 30 minutes to complete this form before the date is released to others.",
  moveToAnotherVenue:
    "If this client actually needs a different hall, use this to send them to the right team.",
  flagContact:
    "Mark this person as someone to handle carefully. They can still be contacted — this is just a warning for your team.",
  mainCoordinator:
    "When a client needs multiple venues, one person collects all their details and coordinates across teams.",
  skipApproval:
    "When ON, this staff member's venue transfers are approved automatically without super admin review.",
  autoPaymentReminder:
    "The system automatically sends payment reminders to the client at the right times before their event.",
  activeDateHolds:
    "Dates currently being held for enquiries that have not yet confirmed payment.",
  pendingQuote:
    "A quote you sent but the client has not replied to yet.",
  overdueFollowUp:
    "A call you were supposed to make that is now past its scheduled time.",
} as const;

export type TooltipKey = keyof typeof TOOLTIPS;
