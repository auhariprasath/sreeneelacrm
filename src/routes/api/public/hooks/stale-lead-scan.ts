import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Stale-lead scan: scans every company's leads against per-stage thresholds
// and writes notifications to admins (+ SAs for "no reply" escalations).
// Stage mapping (lead.status → threshold key):
//   new → new, in_progress → in_progress, neutral/negative → no_reply
//   positive WITHOUT a sent quote → no_reply
// Quote-stage thresholds (quote_sent / quote_accepted) check the latest
// quotation status, scoped to leads with a quotation in those states.
export const Route = createFileRoute("/api/public/hooks/stale-lead-scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("apikey") || request.headers.get("authorization")?.replace("Bearer ", "");
        if (!token) return new Response(JSON.stringify({ error: "missing apikey" }), { status: 401 });

        const supabase = createClient(import.meta.env.VITE_SUPABASE_URL!, token, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: companies, error: cErr } = await supabase
          .from("companies")
          .select("id, stale_alerts_enabled, stale_thresholds")
          .is("deleted_at", null);
        if (cErr) return Response.json({ error: cErr.message }, { status: 500 });

        const now = Date.now();
        let created = 0;

        // Resolve admins per company + super admins (one query each, small N)
        const { data: roleRows } = await supabase.from("user_roles").select("user_id, role");
        const saIds = (roleRows ?? []).filter((r) => r.role === "super_admin").map((r) => r.user_id);
        const adminIds = (roleRows ?? []).filter((r) => r.role === "admin").map((r) => r.user_id);
        const { data: profileRows } = await supabase.from("profiles")
          .select("id, company_id").in("id", adminIds.length ? adminIds : ["00000000-0000-0000-0000-000000000000"]);
        const adminsByCompany = new Map<string, string[]>();
        (profileRows ?? []).forEach((p: any) => {
          if (!p.company_id) return;
          const arr = adminsByCompany.get(p.company_id) ?? [];
          arr.push(p.id); adminsByCompany.set(p.company_id, arr);
        });

        for (const co of companies ?? []) {
          if (!(co as any).stale_alerts_enabled) continue;
          const t = (co as any).stale_thresholds ?? {};
          const thr = {
            new: Number(t.new ?? 2),
            in_progress: Number(t.in_progress ?? 3),
            quote_sent: Number(t.quote_sent ?? 7),
            quote_accepted: Number(t.quote_accepted ?? 3),
            no_reply: Number(t.no_reply ?? 5),
          };

          const recipients = adminsByCompany.get(co.id) ?? [];
          if (recipients.length === 0 && saIds.length === 0) continue;

          // 1) Status-based stages
          const stageMap: Array<{ status: string; days: number; label: string; alsoNotifySa?: boolean }> = [
            { status: "new", days: thr.new, label: "New enquiry" },
            { status: "in_progress", days: thr.in_progress, label: "Getting details" },
            { status: "neutral", days: thr.no_reply, label: "No reply", alsoNotifySa: true },
          ];

          for (const stage of stageMap) {
            const cutoff = new Date(now - stage.days * 86400_000).toISOString();
            const { data: leads } = await supabase.from("leads")
              .select("id, full_name, status, updated_at")
              .eq("company_id", co.id).eq("status", stage.status as any)
              .is("deleted_at", null).lt("updated_at", cutoff);
            for (const ld of leads ?? []) {
              const days = Math.floor((now - new Date(ld.updated_at).getTime()) / 86400_000);
              const audience = stage.alsoNotifySa ? [...recipients, ...saIds] : recipients;
              for (const userId of audience) {
                // dedupe: skip if same lead+title was notified in last 24h
                const sinceDay = new Date(now - 86400_000).toISOString();
                const { count } = await supabase.from("notifications")
                  .select("id", { count: "exact", head: true })
                  .eq("user_id", userId).eq("lead_id", ld.id).eq("type", "system" as any)
                  .gte("created_at", sinceDay).ilike("title", "Stale lead%");
                if ((count ?? 0) > 0) continue;
                await supabase.from("notifications").insert({
                  user_id: userId, lead_id: ld.id, type: "system",
                  title: "Stale lead",
                  body: `${ld.full_name} has been in ${stage.label} for ${days} days. Review needed.`,
                });
                created++;
              }
            }
          }
        }

        return Response.json({ ok: true, created });
      },
    },
  },
});
