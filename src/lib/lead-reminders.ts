import { supabase } from "@/integrations/supabase/client";

/**
 * A lead profile should only have ONE active reminder at a time — either a
 * call follow-up or a venue visit. When a new one is scheduled, automatically
 * mark all other active reminders for the same lead as done.
 *
 * Pass `keep` to skip the just-created record.
 */
export async function closeOtherActiveReminders(
  leadId: string,
  keep?: { followUpId?: string; venueMeetingId?: string },
): Promise<void> {
  // Mark other pending follow-ups as done (only one active reminder per lead).
  let followUps = supabase
    .from("follow_ups")
    .update({ is_sent: true, sent_at: new Date().toISOString() })
    .eq("lead_id", leadId)
    .eq("is_sent", false)
    .eq("is_cancelled", false);
  if (keep?.followUpId) followUps = followUps.neq("id", keep.followUpId);

  // Close pending venue meetings (mark as completed).
  let meetings = supabase
    .from("venue_meetings")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("lead_id", leadId)
    .in("status", ["scheduled", "reminder_sent", "rescheduled"]);
  if (keep?.venueMeetingId) meetings = meetings.neq("id", keep.venueMeetingId);

  await Promise.all([followUps, meetings]);
}
