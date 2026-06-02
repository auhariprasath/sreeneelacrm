import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Resolves role-based task assignees for a company.
 * - manager: first admin (preferring active, not on leave)
 * - ops_supervisor: second admin if any, else falls back to manager
 * - any_available: active staff/admin with fewest open tasks (not on leave)
 */
export const resolveTaskAssignees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ company_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Authorize: caller must be in the same company (or super_admin)
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", context.userId);
    const isSA = (callerRoles ?? []).some((r) => r.role === "super_admin");
    if (!isSA && callerProfile?.company_id !== data.company_id) {
      throw new Error("Not permitted");
    }

    // Load active profiles in the company
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, on_leave, is_active")
      .eq("company_id", data.company_id)
      .eq("is_active", true)
      .is("deleted_at", null);

    const candidates = (profiles ?? []).filter((p) => !p.on_leave);
    if (candidates.length === 0) {
      return { manager_id: null, ops_supervisor_id: null, any_available_id: null };
    }

    const ids = candidates.map((p) => p.id);
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles").select("user_id, role").in("user_id", ids);
    const byUser = new Map<string, Set<string>>();
    for (const r of roleRows ?? []) {
      if (!byUser.has(r.user_id)) byUser.set(r.user_id, new Set());
      byUser.get(r.user_id)!.add(r.role);
    }

    const admins = candidates.filter((p) => byUser.get(p.id)?.has("admin"));
    const manager_id = admins[0]?.id ?? null;
    const ops_supervisor_id = admins[1]?.id ?? manager_id;

    // Compute open task count per candidate for "any_available"
    const { data: openTasks } = await supabaseAdmin
      .from("tasks")
      .select("assigned_to")
      .eq("company_id", data.company_id)
      .in("status", ["pending", "in_progress", "overdue"])
      .is("deleted_at", null);
    const counts = new Map<string, number>();
    for (const t of openTasks ?? []) {
      if (!t.assigned_to) continue;
      counts.set(t.assigned_to, (counts.get(t.assigned_to) ?? 0) + 1);
    }
    const any_available_id = [...candidates]
      .sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0))[0]?.id ?? null;

    return { manager_id, ops_supervisor_id, any_available_id };
  });
