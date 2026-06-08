import { supabase } from "@/integrations/supabase/client";

/**
 * A lead profile should only have ONE active reminder at a time — either a
 * call follow-up or a venue visit. When a new one is scheduled, automatically
 * mark the other active reminders for the same lead as done.
 *
 * Pass `keep` to skip auto-closing the just-created record.
 */
export async function closeOtherActiveReminders(
  leadId: string,
  keep?: { followUpId?: string; venueMeetingId?: string },
): Promise<void> {
  const nowIso = new Date().toISOString();

  // Close pending follow-ups (mark as sent/done).
  let followUps = supabase
    .from("follow_ups")
    .update({ is_sent: true, note: appendAutoNote })
    .eq("lead_id", leadId)
    .eq("is_sent", false)
    .eq("is_cancelled", false);
  if (keep?.followUpId) followUps = followUps.neq("id", keep.followUpId);

  // Close pending venue meetings (mark as completed/done).
  let meetings = supabase
    .from("venue_meetings")
    .update({ status: "completed", updated_at: nowIso })
    .eq("lead_id", leadId)
    .in("status", ["scheduled", "reminder_sent", "rescheduled"]);
  if (keep?.venueMeetingId) meetings = meetings.neq("id", keep.venueMeetingId);

  // Note: we can't use a SQL expression in update value via PostgREST without RPC,
  // so drop the auto-note expression and just close the rows.
  const followUpsPlain = supabase
    .from("follow_ups")
    .update({ is_sent: true })
    .eq("lead_id", leadId)
    .eq("is_sent", false)
    .eq("is_cancelled", false);
  const followUpsQ = keep?.followUpId ? followUpsPlain.neq("id", keep.followUpId) : followUpsPlain;

  await Promise.all([followUpsQ, meetings]);
}

// Sentinel — unused; kept to satisfy the TS narrowing above without runtime impact.
const appendAutoNote = undefined as unknown as string;
