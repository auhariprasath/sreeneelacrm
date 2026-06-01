import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface SeedAccount {
  email: string;
  full_name: string;
  role: "super_admin" | "admin" | "staff";
  company_id: string | null;
}

const PASSWORD = "Neela@2026";

const COMPANIES = {
  A: "11111111-1111-1111-1111-111111111111",
  B: "22222222-2222-2222-2222-222222222222",
  C: "33333333-3333-3333-3333-333333333333",
  D: "44444444-4444-4444-4444-444444444444",
};

const ACCOUNTS: SeedAccount[] = [
  { email: "admin@neelaevents.com",        full_name: "Super Admin",       role: "super_admin", company_id: null },
  { email: "admin.a@neelaevents.com",      full_name: "Company A Admin",   role: "admin",       company_id: COMPANIES.A },
  { email: "admin.b@neelaevents.com",      full_name: "Company B Admin",   role: "admin",       company_id: COMPANIES.B },
  { email: "admin.c@neelaevents.com",      full_name: "Company C Admin",   role: "admin",       company_id: COMPANIES.C },
  { email: "admin.d@neelaevents.com",      full_name: "Company D Admin",   role: "admin",       company_id: COMPANIES.D },
  { email: "staff1.a@neelaevents.com",     full_name: "Staff 1 (A)",       role: "staff",       company_id: COMPANIES.A },
  { email: "staff2.a@neelaevents.com",     full_name: "Staff 2 (A)",       role: "staff",       company_id: COMPANIES.A },
];

export const Route = createFileRoute("/api/public/seed")({
  server: {
    handlers: {
      POST: async () => {
        const results: { email: string; status: string; userId?: string; error?: string }[] = [];

        for (const acct of ACCOUNTS) {
          try {
            // Try to find existing user
            const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
            let existing = list?.users.find((u) => u.email?.toLowerCase() === acct.email.toLowerCase());

            let userId: string;
            if (existing) {
              userId = existing.id;
              results.push({ email: acct.email, status: "exists", userId });
            } else {
              const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
                email: acct.email,
                password: PASSWORD,
                email_confirm: true,
                user_metadata: { full_name: acct.full_name },
              });
              if (cErr || !created.user) {
                results.push({ email: acct.email, status: "error", error: cErr?.message ?? "unknown" });
                continue;
              }
              userId = created.user.id;
              results.push({ email: acct.email, status: "created", userId });
            }

            // Upsert profile
            await supabaseAdmin.from("profiles").upsert({
              id: userId,
              full_name: acct.full_name,
              email: acct.email,
              company_id: acct.company_id,
              must_change_password: false, // seed accounts: don't force change
              is_active: true,
            }, { onConflict: "id" });

            // Assign role
            await supabaseAdmin.from("user_roles").upsert(
              { user_id: userId, role: acct.role },
              { onConflict: "user_id,role" }
            );
          } catch (e) {
            results.push({ email: acct.email, status: "error", error: (e as Error).message });
          }
        }

        return new Response(JSON.stringify({ ok: true, results }, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => new Response("POST to run seed", { status: 405 }),
    },
  },
});
