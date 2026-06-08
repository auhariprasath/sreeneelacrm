import { supabase } from "@/integrations/supabase/client";

/**
 * Each reminder kind (follow_up, venue_meeting) can have ONE active record
 * per lead at a time. Scheduling a new one closes other ACTIVE records of
 * the SAME kind only — it does NOT touch the other kind.
 *
 * Pass `keep` to skip the just-created record.
 */
export async function closeOtherActiveReminders(
  leadId: string,
  options?: { kind?: "follow_up" | "venue_meeting"; followUpId?: string; venueMeetingId?: string },
): Promise<void> {
  const kind = options?.kind ?? "follow_up";

  if (kind === "follow_up") {
    let q = supabase
      .from("follow_ups")
      .update({ is_sent: true })
      .eq("lead_id", leadId)
      .eq("is_sent", false)
      .eq("is_cancelled", false);
    if (options?.followUpId) q = q.neq("id", options.followUpId);
    await q;
    return;
  }

  let q = supabase
    .from("venue_meetings")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("lead_id", leadId)
    .in("status", ["scheduled", "reminder_sent", "rescheduled"]);
  if (options?.venueMeetingId) q = q.neq("id", options.venueMeetingId);
  await q;
}
