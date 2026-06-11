import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { AppRole } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Phone, MessageSquare, ArrowRightLeft } from "lucide-react";
import { SkeletonList } from "@/components/skeleton-list";
import { EmptyState } from "@/components/empty-state";
import { formatPhoneIN, relativeTime, initialsOf } from "@/lib/format";
import { StatusBadge, STATUS_LABELS } from "@/components/leads/lead-badges";
import { NewLeadDialog } from "@/components/leads/new-lead-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn, buildWaMeLink, openWaMeLink } from "@/lib/utils";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Status = Database["public"]["Enums"]["lead_status"];
type ReqMeta = { nextEvent: string | null };

const PAGE = 25;
const STATUS_TABS: { key: "all" | Status; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "in_progress", label: "Active" },
  { key: "follow_up", label: "Follow-up" },
  { key: "venue_meeting", label: "Venue meeting" },
  { key: "positive", label: "Interested" },
  { key: "unresponsive", label: "No reply" },
  { key: "closed", label: "Closed" },
];

const leadsSearchSchema = z.object({
  filter: fallback(z.enum(["new", "followup_due"]).optional(), undefined),
  company: fallback(z.string().uuid().optional(), undefined),
});

export const Route = createFileRoute("/_app/leads/")({
  component: LeadsInbox,
  validateSearch: zodValidator(leadsSearchSchema),
});

function LeadsInbox() {
  const { profile, role, activeCompanyId } = useAuth();
  const searchParams = Route.useSearch();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | Status>(searchParams.filter === "new" ? "new" : "all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [open, setOpen] = useState(false);
  const [reqMeta, setReqMeta] = useState<Record<string, ReqMeta>>({});
  const [assignedNames, setAssignedNames] = useState<Record<string, string>>({});
  const [transferLead, setTransferLead] = useState<Lead | null>(null);
  const [transferReason, setTransferReason] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);
  const [followupDueIds, setFollowupDueIds] = useState<string[] | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const followupDue = searchParams.filter === "followup_due";

  const companyFilter = useMemo(() => {
    if (role === "super_admin") return activeCompanyId;
    return profile?.company_id ?? null;
  }, [role, activeCompanyId, profile]);

  // Fetch lead IDs with follow-ups due today (pending, scheduled for today or earlier)
  useEffect(() => {
    if (!followupDue) { setFollowupDueIds(null); return; }
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
    let q = supabase.from("follow_ups")
      .select("lead_id, leads!inner(company_id)")
      .eq("is_sent", false).eq("is_cancelled", false)
      .lte("scheduled_at", endOfDay.toISOString());
    if (companyFilter) q = q.eq("leads.company_id", companyFilter);
    q.then(({ data }) => {
      const ids = Array.from(new Set(((data ?? []) as any[]).map((r) => r.lead_id).filter(Boolean)));
      setFollowupDueIds(ids);
    });
  }, [followupDue, companyFilter]);

  const fetchPage = async (pg: number, reset = false) => {
    if (reset) setLoading(true);
    if (followupDue && followupDueIds === null) return; // wait for ids
    let q = supabase.from("leads").select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .range(pg * PAGE, pg * PAGE + PAGE - 1);
    if (companyFilter) q = q.eq("company_id", companyFilter);
    if (status !== "all") q = q.eq("status", status);
    if (followupDue) {
      if (!followupDueIds || followupDueIds.length === 0) {
        setLeads([]); setHasMore(false); setLoading(false); return;
      }
      q = q.in("id", followupDueIds);
    }
    if (search.trim()) {
      const s = search.trim().replace(/'/g, "''");
      q = q.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%`);
    }
    const { data, error } = await q;
    if (error) { setLoading(false); return; }
    setHasMore((data?.length ?? 0) === PAGE);
    const next = reset ? (data ?? []) : [...leads, ...(data ?? [])];
    setLeads(next);
    setLoading(false);
    const newLeads = data ?? [];
    void loadReqMeta(newLeads.map((l) => l.id));
    void loadAssignedNames(newLeads);
  };

  const loadAssignedNames = async (leads: Lead[]) => {
    const ids = [...new Set(leads.map((l) => l.assigned_to).filter(Boolean))] as string[];
    if (ids.length === 0) return;
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    if (!data) return;
    const map: Record<string, string> = {};
    for (const p of data as any[]) map[p.id] = p.full_name;
    setAssignedNames((prev) => ({ ...prev, ...map }));
  };

  const loadReqMeta = async (ids: string[]) => {
    if (ids.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data: reqRes } = await supabase.from("requirements")
      .select("lead_id, event_date")
      .in("lead_id", ids).is("deleted_at", null)
      .not("event_date", "is", null).gte("event_date", today);
    const meta: Record<string, ReqMeta> = {};
    for (const id of ids) meta[id] = { nextEvent: null };
    for (const r of (reqRes ?? []) as any[]) {
      const cur = meta[r.lead_id];
      if (!cur) continue;
      if (!cur.nextEvent || r.event_date < cur.nextEvent) cur.nextEvent = r.event_date;
    }
    setReqMeta((prev) => ({ ...prev, ...meta }));
  };

  const handleAutoAssign = async (lead: Lead) => {
    if (!profile?.id) return;
    if (lead.assigned_to === profile.id) return;
    await supabase.from("leads").update({ assigned_to: profile.id }).eq("id", lead.id);
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, assigned_to: profile.id } : l));
    setAssignedNames((prev) => ({ ...prev, [profile.id]: profile.full_name }));
  };

  const submitTransfer = async () => {
    if (!transferLead || !profile) return;
    if (transferReason.trim().length < 10) { toast.error("Reason must be at least 10 characters"); return; }
    setTransferBusy(true);
    const companyId = transferLead.company_id;
    const { error } = await supabase.from("transfer_requests").insert({
      lead_id: transferLead.id,
      from_company_id: companyId,
      to_company_id: companyId,
      requested_by: profile.id,
      reason: transferReason.trim(),
      requirement_summary: "Employee reassignment request",
      status: "pending",
    });
    setTransferBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Transfer request sent to super admin");
    setTransferLead(null);
    setTransferReason("");
  };

  // initial + filter changes
  useEffect(() => {
    setPage(0);
    fetchPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyFilter, status, followupDue, followupDueIds]);

  // debounced search
  useEffect(() => {
    const t = setTimeout(() => { setPage(0); fetchPage(0, true); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // realtime: prepend new leads, refresh updated ones (within scope)
  useEffect(() => {
    const channel = supabase
      .channel("leads-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, (payload) => {
        const row = (payload.new ?? payload.old) as Lead;
        if (companyFilter && row.company_id !== companyFilter) return;
        if (payload.eventType === "INSERT") {
          setLeads((prev) => (prev.find((l) => l.id === row.id) ? prev : [payload.new as Lead, ...prev]));
        } else if (payload.eventType === "UPDATE") {
          setLeads((prev) => prev.map((l) => (l.id === row.id ? (payload.new as Lead) : l)));
        } else if (payload.eventType === "DELETE") {
          setLeads((prev) => prev.filter((l) => l.id !== row.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyFilter]);

  // infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        const next = page + 1;
        setPage(next);
        fetchPage(next);
      }
    }, { rootMargin: "200px" });
    io.observe(sentinelRef.current);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, page, companyFilter, status]);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Leads</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Inbox of enquiries · pulls in real time</p>
        </div>
        <Button onClick={() => setOpen(true)} className="min-h-11">
          <Plus className="h-4 w-4 mr-1.5" /> New lead
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or phone…"
          className="pl-9 h-11"
        />
      </div>

      {/* Status chips */}
      <div className="flex gap-2 overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0 pb-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={cn(
              "shrink-0 h-9 px-3 rounded-full text-xs font-medium border min-w-[44px]",
              status === t.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border hover:bg-accent"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonList rows={6} />
      ) : leads.length === 0 ? (
        <EmptyState
          title="No leads yet"
          description={search || status !== "all" ? "Try changing the filter or search." : "Create your first lead to get started."}
          actionLabel="New lead"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Assigned to</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Event</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Updated</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <LeadRow
                  key={l.id}
                  lead={l}
                  masked={profile?.phone_masked ?? false}
                  meta={reqMeta[l.id]}
                  assignedName={l.assigned_to ? (assignedNames[l.assigned_to] ?? "…") : undefined}
                  currentProfileId={profile?.id}
                  role={role ?? undefined}
                  onAutoAssign={role !== "super_admin" ? handleAutoAssign : undefined}
                  onTransferRequest={role !== "super_admin" ? (lead) => { setTransferLead(lead); setTransferReason(""); } : undefined}
                />
              ))}
            </tbody>
          </table>
          {hasMore && (
            <div ref={sentinelRef} className="h-12 flex items-center justify-center text-xs text-muted-foreground border-t">
              Loading more…
            </div>
          )}
          {!hasMore && leads.length > PAGE && (
            <div className="h-8 flex items-center justify-center text-[11px] text-muted-foreground border-t">
              End of list
            </div>
          )}
        </div>
      )}

      <NewLeadDialog open={open} onOpenChange={setOpen} />

      {/* Transfer request dialog */}
      <Dialog open={!!transferLead} onOpenChange={(v) => { if (!v) setTransferLead(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Request transfer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Lead: <span className="font-medium text-foreground">{transferLead?.full_name}</span>
            </p>
            <div className="space-y-1.5">
              <Label>Reason <span className="text-muted-foreground text-xs">(min 10 chars)</span></Label>
              <Textarea
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="Why can't you attend this lead?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferLead(null)} disabled={transferBusy}>Cancel</Button>
            <Button onClick={submitTransfer} disabled={transferBusy || transferReason.trim().length < 10}>
              {transferBusy ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeadRow({
  lead, masked, meta, assignedName, currentProfileId, role, onAutoAssign, onTransferRequest,
}: {
  lead: Lead; masked: boolean; meta?: ReqMeta; assignedName?: string;
  currentProfileId?: string; role?: AppRole;
  onAutoAssign?: (lead: Lead) => void;
  onTransferRequest?: (lead: Lead) => void;
}) {
  const phone = formatPhoneIN(lead.phone, masked);
  const tel = (lead.phone || "").replace(/\D/g, "");
  const nextEvent = meta?.nextEvent ? new Date(meta.nextEvent) : null;
  const canTransfer = role !== "super_admin" && lead.assigned_to === currentProfileId && !!currentProfileId;

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <Link to="/leads/$leadId" params={{ leadId: lead.id }} className="flex items-center gap-2.5 hover:underline">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="text-[10px]">{initialsOf(lead.full_name)}</AvatarFallback>
          </Avatar>
          <span className="font-medium truncate max-w-[150px]">{lead.full_name}</span>
          {lead.is_blacklisted && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/30 shrink-0">
              Flagged
            </span>
          )}
        </Link>
      </td>
      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{phone}</td>
      <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{assignedName ?? "—"}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {nextEvent
          ? `${String(nextEvent.getDate()).padStart(2,"0")}/${String(nextEvent.getMonth()+1).padStart(2,"0")}/${nextEvent.getFullYear()}`
          : "—"}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{relativeTime(lead.updated_at)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <a
            href={`tel:+91${tel.slice(-10)}`}
            onClick={() => onAutoAssign?.(lead)}
            className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-accent"
            aria-label="Call"
          >
            <Phone className="h-3.5 w-3.5 text-primary" />
          </a>
          <button
            type="button"
            onClick={() => { onAutoAssign?.(lead); const wa = buildWaMeLink(lead.phone); if (wa) openWaMeLink(wa); }}
            className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-accent"
            aria-label="WhatsApp"
          >
            <MessageSquare className="h-3.5 w-3.5 text-success" />
          </button>
          {canTransfer && (
            <button
              type="button"
              onClick={() => onTransferRequest?.(lead)}
              className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-accent"
              aria-label="Request transfer"
              title="Request transfer to super admin"
            >
              <ArrowRightLeft className="h-3.5 w-3.5 text-warning" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

void STATUS_LABELS; // keeps import live
