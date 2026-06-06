import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Slot = Database["public"]["Tables"]["slots"]["Row"];

/**
 * Count other active requirements on a given company + date.
 * Soft holds are no longer used — slots only lock when a booking is confirmed after payment.
 */
export async function countOtherEnquiriesOnDate(params: {
  companyId: string;
  eventDate: string;
  ignoreRequirementId?: string | null;
}): Promise<number> {
  const { companyId, eventDate, ignoreRequirementId } = params;
  let q = supabase
    .from("requirements")
    .select("id, leads!inner(status)")
    .eq("company_id", companyId)
    .eq("event_date", eventDate)
    .is("deleted_at", null)
    .neq("leads.status", "negative");
  if (ignoreRequirementId) q = q.neq("id", ignoreRequirementId);
  const { data, error } = await q;
  if (error) return 0;
  return (data ?? []).length;
}
