import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Search, Phone, MessageSquare } from "lucide-react";
import { SkeletonList } from "@/components/skeleton-list";
import { EmptyState } from "@/components/empty-state";
import { formatPhoneIN, relativeTime, initialsOf } from "@/lib/format";
import { StatusBadge, ScoreBadge, STATUS_LABELS } from "@/components/leads/lead-badges";
import { NewLeadDialog } from "@/components/leads/new-lead-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Status = Database["public"]["Enums"]["lead_status"];
type ReqMeta = { nextEvent: string | null; holdActive: boolean };

const PAGE = 25;
const STATUS_TABS: { key: "all" | Status; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "in_progress", label: "In progress" },
  { key: "positive", label: "Positive" },
  { key: "unresponsive", label: "Unresponsive" },
  { key: "closed", label: "Closed" },
];

export const Route = createFileRoute("/_app/leads/")({ component: LeadsInbox });

function LeadsInbox() {
  const { profile, role, activeCompanyId } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | Status>("all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [open, setOpen] = useState(false);
  const [reqMeta, setReqMeta] = useState<Record<string, ReqMeta>>({});
  const sentinelRef = useRef<HTMLDivElement>(null);

  const companyFilter = useMemo(() => {
    if (role === "super_admin") return activeCompanyId; // null = all
    return profile?.company_id ?? null;
  }, [role, activeCompanyId, profile]);

  const fetchPage = async (pg: number, reset = false) => {
    if (reset) setLoading(true);
    let q = supabase.from("leads").select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .range(pg * PAGE, pg * PAGE + PAGE - 1);
    if (companyFilter) q = q.eq("company_id", companyFilter);
    if (status !== "all") q = q.eq("status", status);
    if (search.trim()) {
      const s = search.trim().replace(/'/g, "''");
      q = q.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%`);
    }
    const { data, error } = await q;
    if (error) { setLoading(false); return; }
    setHasMore((data?.length ?? 0) === PAGE);
    setLeads((prev) => (reset ? (data ?? []) : [...prev, ...(data ?? [])]));
    setLoading(false);
  };

  // initial + filter changes
  useEffect(() => {
    setPage(0);
    fetchPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyFilter, status]);

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

      {/* List */}
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
        <div className="space-y-2">
          {leads.map((l) => (
            <LeadCard key={l.id} lead={l} masked={profile?.phone_masked ?? false} />
          ))}
          {hasMore && (
            <div ref={sentinelRef} className="h-12 flex items-center justify-center text-xs text-muted-foreground">
              Loading more…
            </div>
          )}
          {!hasMore && leads.length > PAGE && (
            <div className="h-8 flex items-center justify-center text-[11px] text-muted-foreground">
              End of list
            </div>
          )}
        </div>
      )}

      <NewLeadDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function LeadCard({ lead, masked }: { lead: Lead; masked: boolean }) {
  const phone = formatPhoneIN(lead.phone, masked);
  const tel = (lead.phone || "").replace(/\D/g, "");
  return (
    <Link
      to="/leads/$leadId"
      params={{ leadId: lead.id }}
      className="block bg-card border rounded-lg p-3 md:p-4 hover:bg-accent/40 transition-colors"
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="text-xs">{initialsOf(lead.full_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium truncate flex items-center gap-2">
                {lead.full_name}
                {lead.is_blacklisted && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                    Blacklisted
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">{phone}</div>
            </div>
            <ScoreBadge score={lead.lead_score} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <StatusBadge status={lead.status} />
              <span className="text-[11px] text-muted-foreground truncate">{relativeTime(lead.updated_at)}</span>
            </div>
            <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
              <a
                href={`tel:+91${tel.slice(-10)}`}
                onClick={(e) => e.stopPropagation()}
                className="h-9 w-9 rounded-md flex items-center justify-center hover:bg-accent"
                aria-label="Call"
              >
                <Phone className="h-4 w-4 text-primary" />
              </a>
              <a
                href={`https://wa.me/91${tel.slice(-10)}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="h-9 w-9 rounded-md flex items-center justify-center hover:bg-accent"
                aria-label="WhatsApp"
              >
                <MessageSquare className="h-4 w-4 text-emerald-600" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Avoid unused import warning
void STATUS_LABELS;
