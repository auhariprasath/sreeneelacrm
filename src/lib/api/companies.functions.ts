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
      type: z.enum(["banquet", "garden", "mandapam", "party"]).default("banquet"),
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

    await supabaseAdmin.from("profiles")
      .update({ company_id: data.target_company_id, backup_staff_id: null })
      .eq("id", data.user_id);

    await supabaseAdmin.from("profiles")
      .update({ backup_staff_id: null })
      .eq("backup_staff_id", data.user_id);

    return { ok: true };
  });

// ------- Full company details (edit form) -------

const SIGN_TTL = 60 * 60 * 24 * 7; // 7 days

async function signMany(paths: string[]) {
  if (paths.length === 0) return [] as { path: string; url: string }[];
  const { data, error } = await supabaseAdmin.storage
    .from("venue-photos")
    .createSignedUrls(paths, SIGN_TTL);
  if (error) return paths.map((p) => ({ path: p, url: "" }));
  return (data ?? []).map((d, i) => ({ path: paths[i], url: d.signedUrl ?? "" }));
}

async function assertCanEditCompany(userId: string, companyId: string) {
  const { data: roles } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId);
  const isSA = (roles ?? []).some((r) => r.role === "super_admin");
  if (isSA) return;
  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  if (!isAdmin) throw new Error("Only admins or super admins can edit company details");
  const { data: prof } = await supabaseAdmin
    .from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (prof?.company_id !== companyId) throw new Error("You can only edit your own company");
}

export const getCompanyDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertCanEditCompany(context.userId, data.id);
    const { data: row, error } = await supabaseAdmin
      .from("companies")
      .select(
        "id,name,type,wa_number,company_phone,email,address,full_address,google_maps_link,gstin,bank_account,ifsc,upi_id,logo_url,brand_color,max_capacity,venue_photos,cancellation_policy,portfolio_url,video_url,include_photos_in_requirements,include_portfolio_in_day5",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Company not found");

    const gallery = Array.isArray(row.venue_photos) ? (row.venue_photos as string[]) : [];
    const [logoSigned, gallerySigned] = await Promise.all([
      row.logo_url ? signMany([row.logo_url]) : Promise.resolve([]),
      signMany(gallery),
    ]);

    return {
      ...row,
      logoSignedUrl: logoSigned[0]?.url ?? null,
      gallerySignedUrls: gallerySigned,
    };
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  type: z.enum(["banquet", "garden", "mandapam", "party"]),
  wa_number: z.string().max(20).nullable().optional(),
  company_phone: z.string().max(20).nullable().optional(),
  email: z.union([z.string().email().max(255), z.literal("")]).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  full_address: z.string().max(1000).nullable().optional(),
  google_maps_link: z.string().max(500).nullable().optional(),
  gstin: z.string().max(20).nullable().optional(),
  bank_account: z.string().max(30).nullable().optional(),
  ifsc: z.string().max(15).nullable().optional(),
  upi_id: z.string().max(100).nullable().optional(),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  max_capacity: z.number().int().min(0).max(100000).nullable().optional(),
  cancellation_policy: z.string().max(2000).nullable().optional(),
  portfolio_url: z.string().max(500).nullable().optional(),
  video_url: z.string().max(500).nullable().optional(),
  include_photos_in_requirements: z.boolean().optional(),
  include_portfolio_in_day5: z.boolean().optional(),
});

export const updateCompanyDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCanEditCompany(context.userId, data.id);
    const { id, ...patch } = data;
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      cleaned[k] = v === "" ? null : v;
    }
    const { error } = await supabaseAdmin.from("companies").update(cleaned as never).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const uploadSchema = z.object({
  company_id: z.string().uuid(),
  kind: z.enum(["logo", "gallery"]),
  filename: z.string().min(1).max(200),
  content_type: z.string().min(1).max(100),
  data_base64: z.string().min(1),
});

export const uploadCompanyFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => uploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCanEditCompany(context.userId, data.company_id);
    const buf = Buffer.from(data.data_base64, "base64");
    if (buf.length > 5 * 1024 * 1024) throw new Error("File too large (max 5MB)");
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${data.company_id}/${data.kind}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("venue-photos")
      .upload(path, buf, { contentType: data.content_type, upsert: false });
    if (upErr) throw new Error(upErr.message);

    if (data.kind === "logo") {
      await supabaseAdmin.from("companies").update({ logo_url: path }).eq("id", data.company_id);
    } else {
      const { data: row } = await supabaseAdmin
        .from("companies").select("venue_photos").eq("id", data.company_id).maybeSingle();
      const current = Array.isArray(row?.venue_photos) ? (row!.venue_photos as string[]) : [];
      await supabaseAdmin.from("companies")
        .update({ venue_photos: [...current, path] }).eq("id", data.company_id);
    }

    const signed = await signMany([path]);
    return { path, url: signed[0]?.url ?? "" };
  });

export const removeCompanyFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      company_id: z.string().uuid(),
      kind: z.enum(["logo", "gallery"]),
      path: z.string().min(1),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCanEditCompany(context.userId, data.company_id);
    await supabaseAdmin.storage.from("venue-photos").remove([data.path]);
    if (data.kind === "logo") {
      await supabaseAdmin.from("companies").update({ logo_url: null }).eq("id", data.company_id);
    } else {
      const { data: row } = await supabaseAdmin
        .from("companies").select("venue_photos").eq("id", data.company_id).maybeSingle();
      const current = Array.isArray(row?.venue_photos) ? (row!.venue_photos as string[]) : [];
      await supabaseAdmin.from("companies")
        .update({ venue_photos: current.filter((p) => p !== data.path) })
        .eq("id", data.company_id);
    }
    return { ok: true };
  });

