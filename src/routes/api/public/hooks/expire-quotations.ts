import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Daily quotation auto-expiry.
// Marks status=sent quotations as expired when sent_at < now() - company.quotation_valid_days,
// notifies the assigned staff, and writes an activity log.
export const Route = createFileRoute("/api/public/hooks/expire-quotations")({
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
          .select("id, quotation_valid_days")
          .is("deleted_at", null);
        if (cErr) return Response.json({ error: cErr.message }, { status: 500 });

        const now = Date.now();
        let expired = 0;

        for (const co of companies ?? []) {
          const days = Math.max(1, Number((co as any).quotation_valid_days ?? 7));
          const cutoff = new Date(now - days * 86400_000).toISOString();

          const { data: quotes } = await supabase
            .from("quotations")
            .select("id, lead_id, version, quotation_number, created_by, sent_at")
            .eq("company_id", co.id)
            .eq("status", "sent")
            .lt("sent_at", cutoff)
            .is("deleted_at", null);

          for (const q of quotes ?? []) {
            const { error: upErr } = await supabase
              .from("quotations")
              .update({ status: "expired" })
              .eq("id", q.id);
            if (upErr) continue;
            expired++;

            // Lookup lead name + assigned staff for the notification
            const { data: lead } = await supabase
              .from("leads")
              .select("id, full_name, assigned_to")
              .eq("id", q.lead_id)
              .maybeSingle();

            const recipient = lead?.assigned_to || q.created_by;
            if (recipient) {
              await supabase.from("notifications").insert({
                user_id: recipient,
                lead_id: q.lead_id,
                type: "system",
                title: "Quotation expired",
                body: `Quotation expired — ${lead?.full_name ?? "client"}. Create a new one?`,
              });
            }

            await supabase.from("activity_logs").insert({
              lead_id: q.lead_id,
              action: "Quotation expired automatically.",
              action_type: "system",
              metadata: { quotation_id: q.id, version: q.version, number: q.quotation_number },
            });
          }
        }

        return Response.json({ ok: true, expired });
      },
    },
  },
});
