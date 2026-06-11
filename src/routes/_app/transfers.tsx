import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { SkeletonList } from "@/components/skeleton-list";
import { EmptyState } from "@/components/empty-state";
import { formatDateTimeIN } from "@/lib/format";
import { ArrowRight, Check, X, UserCheck, ThumbsDown } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Transfer = Database["public"]["Tables"]["transfer_requests"]["Row"];
type Lead = Database["public"]["Tables"]["leads"]["Row"];

export const Route = createFileRoute("/_app/transfers")({ component: TransfersPage });

interface EnrichedTransfer extends Transfer {
  lead_name?: string;
  lead_phone?: string;
  lead_assigned_to?: string | null;
  from_name?: string;
  to_name?: string;
  requester_name?: string;
}

// Per-user pass list stored in localStorage so each staff member's "Pass" is independent
function getPassedIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`neela-transfer-passes-${userId}`);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}
function addPassedId(userId: string, transferId: string) {
  const set = getPassedIds(userId);
  set.add(transferId);
  localStorage.setItem(`neela-transfer-passes-${userId}`, JSON.stringify([...set]));
}

function TransfersPage() {
  const { profile, role, companies, activeCompanyId } = useAuth();
  const [items, setItems] = useState<EnrichedTransfer[]>([]);
  const [availableItems, setAvailableItems] = useState<EnrichedTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableLoading, setAvailableLoading] = useState(true);
  const [tab, setTab] = useState<"available" | "pending" | "all">("available");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [passedIds, setPassedIds] = useState<Set<string>>(new Set());

  const isSA = role === "super_admin";

  const companyFilter = useMemo(() => {
    if (role === "super_admin") return activeCompanyId;
    return profile?.company_id ?? null;
  }, [role, activeCompanyId, profile]);

  // Load passed IDs from localStorage on mount
  useEffect(() => {
    if (profile?.id) setPassedIds(getPassedIds(profile.id));
  }, [profile?.id]);

  const enrichRows = async (rows: Transfer[]) => {
    const leadIds = [...new Set(rows.map((r) => r.lead_id))];
    const userIds = [...new Set(rows.map((r) => r.requested_by))];
    const [{ data: leads }, { data: profs }] = await Promise.all([
      leadIds.length
        ? supabase.from("leads").select("id,full_name,phone,assigned_to").in("id", leadIds)
        : Promise.resolve({ data: [] as any[] }),
      userIds.length
        ? supabase.from("profiles").select("id,full_name").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const leadMap = new Map((leads ?? []).map((l: any) => [l.id, l]));
    const userMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
    const companyMap = new Map(companies.map((c) => [c.id, c.name]));
    return rows.map((r) => {
      const lead: any = leadMap.get(r.lead_id) ?? {};
      return {
        ...r,
        lead_name: lead.full_name ?? "Unknown lead",
        lead_phone: lead.phone ?? null,
        lead_assigned_to: lead.assigned_to ?? null,
        from_name: companyMap.get(r.from_company_id) ?? "—",
        to_name: companyMap.get(r.to_company_id) ?? "—",
        requester_name: userMap.get(r.requested_by) ?? "—",
      };
    });
  };

  // Load "Available for Claim" tab — approved transfers with unassigned lead in this company
  const loadAvailable = async () => {
    if (!companyFilter) { setAvailableItems([]); setAvailableLoading(false); return; }
    setAvailableLoading(true);
    const { data, error } = await supabase
      .from("transfer_requests")
      .select("*")
      .eq("status", "approved")
      .eq("to_company_id", companyFilter)
      .order("created_at", { ascending: false });
    if (error) { setAvailableLoading(false); return; }
    const rows = (data ?? []) as Transfer[];
    // Only show where lead is still unassigned
    if (rows.length === 0) { setAvailableItems([]); setAvailableLoading(false); return; }
    const leadIds = [...new Set(rows.map((r) => r.lead_id))];
    const { data: leads } = await supabase
      .from("leads")
      .select("id,assigned_to")
      .in("id", leadIds)
      .is("deleted_at", null);
    const unassigned = new Set(
      (leads ?? []).filter((l: any) => l.assigned_to === null).map((l: any) => l.id)
    );
    const claimable = rows.filter((r) => unassigned.has(r.lead_id));
    const enriched = await enrichRows(claimable);
    setAvailableItems(enriched);
    setAvailableLoading(false);
  };

  // Load pending/all tab (super admin)
  const load = async () => {
    setLoading(true);
    let q = supabase.from("transfer_requests").select("*").order("created_at", { ascending: false });
    if (tab === "pending") q = q.eq("status", "pending");
    if (role === "super_admin" && activeCompanyId)
      q = q.or(`from_company_id.eq.${activeCompanyId},to_company_id.eq.${activeCompanyId}`);
    const { data, error } = await q;
    if (error) { setLoading(false); toast.error(error.message); return; }
    const enriched = await enrichRows((data ?? []) as Transfer[]);
    setItems(enriched);
    setLoading(false);
  };

  useEffect(() => {
    loadAvailable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyFilter, companies.length]);

  useEffect(() => {
    if (tab !== "available") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, companies.length, activeCompanyId, role]);

  // Real-time: refresh both lists on any transfer or lead change
  useEffect(() => {
    const ch = supabase
      .channel("transfers-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "transfer_requests" }, () => {
        loadAvailable();
        if (tab !== "available") load();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads" }, () => {
        loadAvailable();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, companyFilter]);

  const isInternal = (t: EnrichedTransfer) => t.from_company_id === t.to_company_id;

  // Super admin: approve pending transfer → lead goes into Available pool
  const approve = async (t: EnrichedTransfer) => {
    if (!profile) return;
    const { error: e1 } = await supabase.from("transfer_requests")
      .update({ status: "approved", reviewed_by: profile.id })
      .eq("id", t.id);
    if (e1) { toast.error(e1.message); return; }

    // Unlock lead and unassign so it appears in Available pool
    if (isInternal(t)) {
      await supabase.from("leads").update({ assigned_to: null, status: "new" }).eq("id", t.lead_id);
    } else {
      await supabase.from("leads").update({
        company_id: t.to_company_id, assigned_to: null, status: "new",
      }).eq("id", t.lead_id);
    }

    await supabase.from("activity_logs").insert({
      lead_id: t.lead_id,
      action: isInternal(t) ? "Reassignment approved" : "Transfer approved — available for claim",
      note: isInternal(t)
        ? `Approved reassignment request from ${t.requester_name}. Lead is now in claim pool.`
        : `Approved transfer to ${t.to_name}. Lead is now in claim pool.`,
      action_type: "transfer",
      performed_by: profile.id,
    });

    // Notify all active staff at target company that a lead is available to claim
    const targetCompany = isInternal(t) ? t.from_company_id : t.to_company_id;
    const { data: staffList } = await supabase
      .from("profiles")
      .select("id")
      .eq("company_id", targetCompany)
      .eq("is_active", true)
      .is("deleted_at", null);
    const recipientIds = (staffList ?? [])
      .map((p: any) => p.id)
      .filter((id: string) => id !== profile.id && id !== t.requested_by);

    if (recipientIds.length > 0) {
      await supabase.from("notifications").insert(
        recipientIds.map((uid: string) => ({
          user_id: uid,
          lead_id: t.lead_id,
          type: "transfer" as const,
          title: "Lead available to claim",
          body: `A lead "${t.lead_name}" is now available in the Transfer pool. Claim it to take ownership.`,
        }))
      );
    }
    // Also notify requester
    await supabase.from("notifications").insert({
      user_id: t.requested_by,
      lead_id: t.lead_id,
      type: "transfer" as const,
      title: isInternal(t) ? "Reassignment approved" : "Transfer approved",
      body: `Your request for "${t.lead_name}" was approved. The lead is now in the claim pool.`,
    });

    toast.success("Approved — lead is now available for staff to claim");
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

    // Unlock lead back to requester
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
      type: "transfer" as const,
      title: "Transfer rejected",
      body: `Your transfer request was rejected. Reason: ${rejectReason.trim()}`,
    });

    setRejectId(null);
    setRejectReason("");
    toast.success("Transfer rejected");
  };

  // Staff: claim a lead from the pool
  const claim = async (t: EnrichedTransfer) => {
    if (!profile) return;
    setClaimingId(t.id);
    // Atomic check + assign: only update if still unassigned
    const { data: updated, error } = await supabase
      .from("leads")
      .update({ assigned_to: profile.id, status: "in_progress" })
      .eq("id", t.lead_id)
      .is("assigned_to", null)
      .select("id")
      .maybeSingle();
    setClaimingId(null);

    if (error || !updated) {
      toast.error("This lead was already claimed by someone else");
      loadAvailable();
      return;
    }

    await supabase.from("activity_logs").insert({
      lead_id: t.lead_id,
      action: "Lead claimed from transfer pool",
      note: `Claimed by ${profile.full_name}`,
      action_type: "transfer",
      performed_by: profile.id,
    });

    // Notify the original requester
    await supabase.from("notifications").insert({
      user_id: t.requested_by,
      lead_id: t.lead_id,
      type: "transfer" as const,
      title: "Lead claimed",
      body: `"${t.lead_name}" was claimed by ${profile.full_name}.`,
    });

    toast.success(`Lead "${t.lead_name}" is now assigned to you`);
    loadAvailable();
  };

  // Staff: pass (hide from their view only)
  const pass = (t: EnrichedTransfer) => {
    if (!profile?.id) return;
    addPassedId(profile.id, t.id);
    setPassedIds((prev) => new Set([...prev, t.id]));
    toast("Lead hidden from your view");
  };

  // Available items after filtering out passed ones for this user
  const visibleAvailable = availableItems.filter((t) => !passedIds.has(t.id));

  const tabs = isSA
    ? (["available", "pending", "all"] as const)
    : (["available"] as const);

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold">Transfers</h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          {isSA
            ? "Approve or reject transfer requests, and see leads available for claim."
            : "Claim leads that have been approved for reassignment."}
        </p>
      </div>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-9 px-3 rounded-full text-xs font-medium border min-h-[44px] md:min-h-9 capitalize ${
              tab === t ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
            }`}
          >
            {t === "available"
              ? `Available${visibleAvailable.length > 0 ? ` (${visibleAvailable.length})` : ""}`
              : t === "pending" ? "Pending approval" : "All"}
          </button>
        ))}
      </div>

      {/* ── Available for claim tab ── */}
      {tab === "available" && (
        availableLoading ? (
          <SkeletonList rows={3} />
        ) : visibleAvailable.length === 0 ? (
          <EmptyState
            title="No leads available"
            description="When a transfer is approved by the super admin, leads will appear here for you to claim."
          />
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              These leads have been approved for reassignment. Claim one to take ownership — first to claim gets it.
            </p>
            {visibleAvailable.map((t) => (
              <div key={t.id} className="bg-card border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-medium">{t.lead_name}</div>
                    {t.lead_phone && (
                      <div className="text-xs text-muted-foreground mt-0.5">{t.lead_phone}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Released by {t.requester_name}
                      {!isInternal(t) && (
                        <span> · from {t.from_name}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border bg-info/10 text-info border-info/30 shrink-0">
                    Available
                  </span>
                </div>

                <div className="text-xs space-y-1 bg-muted/40 rounded-md p-3">
                  <div><span className="text-muted-foreground font-medium">Requirement: </span>{t.requirement_summary}</div>
                  <div><span className="text-muted-foreground font-medium">Reason: </span>{t.reason}</div>
                  <div className="text-[11px] text-muted-foreground pt-1">{formatDateTimeIN(t.created_at)}</div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => claim(t)}
                    disabled={claimingId === t.id}
                    className="min-h-10 flex-1"
                  >
                    <UserCheck className="h-4 w-4 mr-1.5" />
                    {claimingId === t.id ? "Claiming…" : "Claim lead"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => pass(t)}
                    disabled={claimingId === t.id}
                    className="min-h-10"
                    title="Hide this lead from your view"
                  >
                    <ThumbsDown className="h-4 w-4 mr-1.5" /> Pass
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Pending / All tabs (super admin) ── */}
      {tab !== "available" && (
        loading ? (
          <SkeletonList rows={4} />
        ) : items.length === 0 ? (
          <EmptyState
            title="No transfers"
            description={tab === "pending" ? "No pending requests." : "No transfers yet."}
          />
        ) : (
          <div className="space-y-2">
            {items.map((t) => (
              <div key={t.id} className="bg-card border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to="/leads/$leadId"
                        params={{ leadId: t.lead_id }}
                        className="font-medium hover:underline"
                      >
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setRejectId(t.id); setRejectReason(""); }}
                      className="min-h-11"
                    >
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
                      <Button size="sm" variant="destructive" onClick={reject} className="min-h-11">
                        Confirm reject
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRejectId(null)} className="min-h-11">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
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
