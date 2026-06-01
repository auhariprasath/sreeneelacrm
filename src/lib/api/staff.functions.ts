import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdminScope(userId: string, targetCompanyId: string) {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isSA = (roles ?? []).some((r) => r.role === "super_admin");
  if (isSA) return { isSA: true, companyId: null as string | null };

  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  if (!isAdmin || prof?.company_id !== targetCompanyId) {
    throw new Error("Not permitted");
  }
  return { isSA: false, companyId: prof.company_id };
}

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(8).max(128),
      full_name: z.string().min(1).max(120),
      phone: z.string().max(20).optional().nullable(),
      role: z.enum(["admin", "staff"]),
      company_id: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminScope(context.userId, data.company_id);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create user");

    const uid = created.user.id;
    await supabaseAdmin.from("profiles").upsert({
      id: uid,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone ?? null,
      company_id: data.company_id,
      is_active: true,
      must_change_password: true,
    });
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    return { id: uid };
  });

export const setStaffActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ user_id: z.string().uuid(), is_active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: target } = await supabaseAdmin
      .from("profiles").select("company_id").eq("id", data.user_id).maybeSingle();
    if (!target?.company_id) throw new Error("Target not found");
    await assertAdminScope(context.userId, target.company_id);

    await supabaseAdmin.from("profiles").update({ is_active: data.is_active }).eq("id", data.user_id);
    if (!data.is_active) {
      // Force sign-out by revoking all refresh tokens
      await supabaseAdmin.auth.admin.signOut(data.user_id, "global").catch(() => {});
    }
    return { ok: true };
  });

export const updateStaffSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      phone_masked: z.boolean().optional(),
      auto_approve_transfers: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: target } = await supabaseAdmin
      .from("profiles").select("company_id").eq("id", data.user_id).maybeSingle();
    if (!target?.company_id) throw new Error("Target not found");
    await assertAdminScope(context.userId, target.company_id);

    const patch: Record<string, boolean> = {};
    if (data.phone_masked !== undefined) patch.phone_masked = data.phone_masked;
    if (data.auto_approve_transfers !== undefined) patch.auto_approve_transfers = data.auto_approve_transfers;
    if (Object.keys(patch).length) {
      await supabaseAdmin.from("profiles").update(patch).eq("id", data.user_id);
    }
    return { ok: true };
  });

export const listCompanyStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ company_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminScope(context.userId, data.company_id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,email,phone,is_active,phone_masked,auto_approve_transfers,must_change_password,last_active_at")
      .eq("company_id", data.company_id)
      .is("deleted_at", null)
      .order("full_name", { ascending: true });
    const ids = (profiles ?? []).map((p) => p.id);
    const { data: roles } = ids.length
      ? await supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids)
      : { data: [] as Array<{ user_id: string; role: string }> };
    const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
    return (profiles ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? "staff" }));
  });
