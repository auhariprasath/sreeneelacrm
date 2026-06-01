import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Slot = Database["public"]["Tables"]["slots"]["Row"];
export type SlotCheck =
  | { status: "free"; conflicts: Slot[]; muhurthamConflict: false }
  | { status: "soft_hold" | "enquiry" | "confirmed"; conflicts: Slot[]; muhurthamConflict: boolean }
  | { status: "muhurtham_conflict"; conflicts: Slot[]; muhurthamConflict: true };

const SOFT_HOLD_MINUTES = 30;

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Auto-free any expired soft holds for this company/date, then return live slots.
 */
async function fetchLiveSlots(companyId: string, eventDate: string) {
  await supabase
    .from("slots")
    .update({ status: "free", held_by_lead_id: null, held_by_requirement_id: null, held_until: null })
    .eq("company_id", companyId)
    .eq("event_date", eventDate)
    .eq("status", "soft_hold")
    .lt("held_until", new Date().toISOString());

  const { data } = await supabase
    .from("slots")
    .select("*")
    .eq("company_id", companyId)
    .eq("event_date", eventDate);
  return (data as Slot[]) ?? [];
}

export async function checkSlot(params: {
  companyId: string;
  eventDate: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  muhurthamTime?: string | null;
  ignoreRequirementId?: string | null;
}): Promise<SlotCheck> {
  const { companyId, eventDate, startTime, endTime, muhurthamTime, ignoreRequirementId } = params;
  const all = await fetchLiveSlots(companyId, eventDate);

  const conflicts = all.filter((s) => {
    if (s.status === "free") return false;
    if (ignoreRequirementId && s.held_by_requirement_id === ignoreRequirementId) return false;
    return overlaps(startTime, endTime, s.start_time.slice(0, 5), s.end_time.slice(0, 5));
  });

  // Muhurtham conflict: muhurtham time falls inside a *confirmed* booking
  const muhurthamConflict =
    !!muhurthamTime &&
    all.some((s) => {
      if (s.status !== "confirmed") return false;
      const mh = muhurthamTime.slice(0, 5);
      return mh >= s.start_time.slice(0, 5) && mh < s.end_time.slice(0, 5);
    });

  if (muhurthamConflict && conflicts.length === 0) {
    return { status: "muhurtham_conflict", conflicts: [], muhurthamConflict: true };
  }

  if (conflicts.some((s) => s.status === "confirmed"))
    return { status: "confirmed", conflicts, muhurthamConflict };
  if (conflicts.some((s) => s.status === "enquiry"))
    return { status: "enquiry", conflicts, muhurthamConflict };
  if (conflicts.some((s) => s.status === "soft_hold"))
    return { status: "soft_hold", conflicts, muhurthamConflict };

  return { status: "free", conflicts: [], muhurthamConflict: false };
}

export async function createSoftHold(params: {
  companyId: string;
  leadId: string;
  requirementId: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  sessionName?: string | null;
}) {
  const heldUntil = new Date(Date.now() + SOFT_HOLD_MINUTES * 60_000).toISOString();
  // Release any prior holds by this requirement first
  await supabase
    .from("slots")
    .update({ status: "free", held_by_lead_id: null, held_by_requirement_id: null, held_until: null })
    .eq("held_by_requirement_id", params.requirementId);

  const { data, error } = await supabase
    .from("slots")
    .insert({
      company_id: params.companyId,
      event_date: params.eventDate,
      start_time: params.startTime,
      end_time: params.endTime,
      session_name: params.sessionName ?? null,
      status: "soft_hold",
      held_by_lead_id: params.leadId,
      held_by_requirement_id: params.requirementId,
      held_until: heldUntil,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Slot;
}

export async function releaseSoftHold(requirementId: string) {
  await supabase
    .from("slots")
    .update({ status: "free", held_by_lead_id: null, held_by_requirement_id: null, held_until: null })
    .eq("held_by_requirement_id", requirementId)
    .eq("status", "soft_hold");
}

export const SOFT_HOLD_MS = SOFT_HOLD_MINUTES * 60_000;
