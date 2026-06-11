import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { SkeletonList } from "@/components/skeleton-list";
import { EmptyState } from "@/components/empty-state";
import { formatDateTimeIN } from "@/lib/format";
import { ArrowRight, Check, X } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Transfer = Database["public"]["Tables"]["transfer_requests"]["Row"];

export const Route = createFileRoute("/_app/transfers")({ component: TransfersPage });

interface EnrichedTransfer extends Transfer {
  lead_name?: string;
  from_name?: string;
  to_name?: string;
  requester_name?: string;
}

function TransfersPage() {
  const { profile, role, companies, activeCompanyId } = useAuth();
  const [items, setItems] = useState<EnrichedTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const isSA = role === "super_admin";

  const load = async () => {
    setLoading(true);
    let q = supabase.from("transfer_requests").select("*").order("created_at", { ascending: false });
    if (tab === "pending") q = q.eq("status", "pending");
    if (role === "super_admin" && activeCompanyId) q = q.or(`from_company_id.eq.${activeCompanyId},to_company_id.eq.${activeCompanyId}`);
    const { data, error } = await q;
    if (error) { setLoading(false); toast.error(error.message); return; }

    const rows = (data ?? []) as Transfer[];
    const leadIds = [...new Set(rows.map((r) => r.lead_id))];
    const userIds = [...new Set(rows.map((r) => r.requested_by))];
    const [{ data: leads }, { data: profs }] = await Promise.all([
      leadIds.length ? supabase.from("leads").select("id,full_name").in("id", leadIds) : Promise.resolve({ data: [] as any[] }),
      userIds.length ? supabase.from("profiles").select("id,full_name").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const leadMap = new Map((leads ?? []).map((l: any) => [l.id, l.full_name]));
    const userMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
    const companyMap = new Map(companies.map((c) => [c.id, c.name]));

    setItems(rows.map((r) => ({
      ...r,
      lead_name: leadMap.get(r.lead_id) ?? "Unknown lead",
      from_name: companyMap.get(r.from_company_id) ?? "—",
      to_name: companyMap.get(r.to_company_id) ?? "—",
      requester_name: userMap.get(r.requested_by) ?? "—",
    })));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab, companies.length, activeCompanyId, role]);

  useEffect(() => {
    const ch = supabase.channel("transfers-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "transfer_requests" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, []);

  const isInternal = (t: EnrichedTransfer) => t.from_company_id === t.to_company_id;

  const approve = async (t: EnrichedTransfer) => {
    if (!profile) return;
    const { error: e1 } = await supabase.from("transfer_requests").update({
      status: "approved", reviewed_by: profile.id,
    }).eq("id", t.id);
    if (e1) { toast.error(e1.message); return; }

    if (isInternal(t)) {
      // Internal reassignment: just unassign from current employee, keep same company
      await supabase.from("leads").update({ assigned_to: null }).eq("id", t.lead_id);
    } else {
      await supabase.from("leads").update({
        company_id: t.to_company_id, assigned_to: null, status: "new",
      }).eq("id", t.lead_id);
    }

    await supabase.from("activity_logs").insert({
      lead_id: t.lead_id,
      action: isInternal(t) ? "Reassignment approved" : "Transfer approved",
      note: isInternal(t) ? `Approved reassignment request from ${t.requester_name}` : `Approved transfer to ${t.to_name}`,
      action_type: "transfer",
      performed_by: profile.id,
    });

    await supabase.from("notifications").insert({
      user_id: t.requested_by,
      lead_id: t.lead_id,
      type: "transfer",
      title: isInternal(t) ? "Reassignment approved" : "Transfer approved",
      body: isInternal(t)
        ? `Your request to reassign ${t.lead_name} was approved. The lead is now unassigned.`
        : `Your transfer request for ${t.lead_name} was approved.`,
    });

    toast.success(isInternal(t) ? "Reassignment approved" : "Transfer approved");
  };

  const reject = async () => {
    if (!profile || !rejectId) return;
    const t = items.find((x) => x.id === rejectId);
    if (!t) return;
    if (rejectReason.trim().length < 10) { toast.error("Reason must be at least 10 characters"); return; }

    const { error } = await supabase.from("transfer_requests").update({
      status: "rejected", reviewed_by: profile.id, rejection_reason: rejectReason.trim(),
    }).eq("id", rejectId);
    if (error) { toast.error(error.message); return; }

    // Unlock lead
    await supabase.from("leads").update({ status: "new" }).eq("id", t.lead_id);

    await supabase.from("activity_logs").insert({
      lead_id: t.lead_id,
      action: "Transfer rejected",
      note: rejectReason.trim(),
      action_type: "transfer",
      performed_by: profile.id,
    });

    await supabase.from("notifications").insert({
      user_id: t.requested_by,
      lead_id: t.lead_id,
      type: "transfer",
      title: "Transfer rejected",
      body: `Your transfer request was rejected. Reason: ${rejectReason.trim()}`,
    });

    setRejectId(null);
    setRejectReason("");
    toast.success("Transfer rejected");
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold">Transfers</h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          {isSA ? "Approve or reject lead transfers between companies." : "Track lead transfers in or out of your company."}
        </p>
      </div>

      <div className="flex gap-2">
        {(["pending", "all"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-9 px-3 rounded-full text-xs font-medium border min-h-[44px] md:min-h-9 ${
              tab === t ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
            }`}
          >
            {t === "pending" ? "Pending" : "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList rows={4} />
      ) : items.length === 0 ? (
        <EmptyState title="No transfers" description={tab === "pending" ? "No pending requests." : "No transfers yet."} />
      ) : (
        <div className="space-y-2">
          {items.map((t) => (
            <div key={t.id} className="bg-card border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to="/leads/$leadId" params={{ leadId: t.lead_id }} className="font-medium hover:underline">
                      {t.lead_name}
                    </Link>
                    {isInternal(t) && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-info/10 text-info border-info/30">
                        Reassignment request
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {isInternal(t) ? (
                      <span>Requested by {t.requester_name} to release this lead</span>
                    ) : (
                      <>
                        <span>{t.from_name}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span>{t.to_name}</span>
                        <span className="opacity-60">· by {t.requester_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <StatusPill status={t.status} />
              </div>

              <div className="text-xs space-y-1">
                <div><span className="text-muted-foreground">Reason: </span>{t.reason}</div>
                <div><span className="text-muted-foreground">Requirement: </span>{t.requirement_summary}</div>
                {t.rejection_reason && (
                  <div className="text-destructive dark:text-destructive">
                    <span className="opacity-80">Rejection note: </span>{t.rejection_reason}
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground">{formatDateTimeIN(t.created_at)}</div>
              </div>

              {isSA && t.status === "pending" && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => approve(t)} className="min-h-11">
                    <Check className="h-4 w-4 mr-1.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setRejectId(t.id); setRejectReason(""); }} className="min-h-11">
                    <X className="h-4 w-4 mr-1.5" /> Reject
                  </Button>
                </div>
              )}

              {rejectId === t.id && (
                <div className="space-y-2 pt-1 border-t mt-2">
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection (min 10 chars)…"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" onClick={reject} className="min-h-11">Confirm reject</Button>
                    <Button size="sm" variant="ghost" onClick={() => setRejectId(null)} className="min-h-11">Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: Transfer["status"] }) {
  const map: Record<Transfer["status"], string> = {
    pending: "bg-warning/15 text-warning dark:text-warning border-warning/30",
    approved: "bg-success/15 text-success dark:text-success border-success/30",
    auto_approved: "bg-success/15 text-success dark:text-success border-success/30",
    rejected: "bg-destructive/15 text-destructive dark:text-destructive border-destructive/30",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${map[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}
