import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertSuperAdmin(userId: string) {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isSA = (roles ?? []).some((r) => r.role === "super_admin");
  if (!isSA) throw new Error("Only super admins can manage companies");
}

export const listAllCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("companies")
      .select("id,name,type,deleted_at,created_at")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      name: z.string().min(1).max(120),
      type: z.enum(["banquet", "decor", "rental", "other"]).default("banquet"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("companies")
      .insert({ name: data.name.trim(), type: data.type })
      .select("id,name,type")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const renameCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(120),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("companies").update({ name: data.name.trim() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const archiveCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), archive: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("companies")
      .update({ deleted_at: data.archive ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveStaffToCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      target_company_id: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);

    // Clear backup pointer (would be in old company), then move
    await supabaseAdmin.from("profiles")
      .update({ company_id: data.target_company_id, backup_staff_id: null })
      .eq("id", data.user_id);

    // Clear references where this user was someone else's backup
    await supabaseAdmin.from("profiles")
      .update({ backup_staff_id: null })
      .eq("backup_staff_id", data.user_id);

    return { ok: true };
  });
