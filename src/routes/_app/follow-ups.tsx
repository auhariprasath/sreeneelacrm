import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDashboardRealtime } from "@/hooks/use-dashboard-realtime";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, ArrowLeft, AlertCircle, CheckCircle2, MessageCircle, PhoneCall } from "lucide-react";
import { formatDateTimeIN, formatDateIN } from "@/lib/format";
import { buildWaMeLink, openWaMeLink } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { CallOutcomeDialog } from "@/components/leads/call-outcome-dialog";
import { FollowUpDialog } from "@/components/leads/follow-up-dialog";

type Filter = "everything" | "overdue" | "upcoming" | "all" | "completed";
type OutcomeFilter = "all" | "interested" | "callback_requested" | "meeting_scheduled" | "other" | "not_interested" | "no_outcome";

export const Route = createFileRoute("/_app/follow-ups")({
  validateSearch: (s: Record<string, unknown>): { filter?: Filter } => ({
    filter: (["everything", "overdue", "upcoming", "all", "completed"].includes(s.filter as string) ? s.filter : "upcoming") as Filter,
  }),
  component: FollowUpsPage,
});

interface Row {
  id: string;
  lead_id: string;
  full_name: string;
  phone: string;
  company_id: string;
  lead_status: string;
  event_type: string | null;
  event_date: string | null;
  event_time: string | null;
  scheduled_at: string;
  is_sent: boolean;
  assigned_to_name: string | null;
  last_outcome: string | null;
  last_outcome_note: string | null;
}

const OUTCOME_LABELS: Record<string, string> = {
  interested: "Interested",
  meeting_scheduled: "Meeting scheduled",
  callback_requested: "Callback requested",
  other: "Other",
  not_interested: "Not interested",
};

const OUTCOME_COLORS: Record<string, string> = {
  interested: "bg-success/15 text-success dark:text-success",
  meeting_scheduled: "bg-info/15 text-info",
  callback_requested: "bg-warning/15 text-warning dark:text-warning",
  other: "bg-muted text-muted-foreground",
  not_interested: "bg-destructive/15 text-destructive dark:text-destructive",
};

function OutcomeBadge({ outcome }: { outcome: string }) {
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${OUTCOME_COLORS[outcome] ?? "bg-muted text-muted-foreground"}`}>
      {OUTCOME_LABELS[outcome] ?? outcome}
    </span>
  );
}

function FollowUpsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const navTo = useNavigate();
  const filter: Filter = search.filter ?? "upcoming";
  const { role, profile, activeCompanyId, companies } = useAuth();
  const companyId = role === "super_admin" ? activeCompanyId : (profile?.company_id ?? companies[0]?.id ?? null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");

  // Dialog state
  const [outcomeDialogRow, setOutcomeDialogRow] = useState<Row | null>(null);
  const [followUpLeadId, setFollowUpLeadId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const isCompleted = filter === "completed";
    const isEverything = filter === "everything";
    let q = supabase.from("follow_ups")
      .select("id, lead_id, scheduled_at, is_sent, leads!inner(full_name, phone, status, assigned_to, company_id)")
      .eq("is_cancelled", false)
      .order("scheduled_at", { ascending: !isCompleted })
      .limit(500);
    if (!isEverything) {
      if (isCompleted) q = q.eq("is_sent", true);
      else q = q.eq("is_sent", false);
    }
    if (companyId) q = q.eq("leads.company_id", companyId);
    const { data } = await q;
    if (!data?.length) { setRows([]); setLoading(false); return; }

    const leadIds = [...new Set((data as any[]).map((f) => f.lead_id))];
    const assigneeIds = [...new Set((data as any[]).map((f) => f.leads?.assigned_to).filter(Boolean))];

    const [{ data: reqs }, { data: profiles }, { data: outcomes }] = await Promise.all([
      supabase.from("requirements").select("lead_id, event_type, event_date, start_time")
        .in("lead_id", leadIds).is("deleted_at", null).order("created_at", { ascending: false }),
      assigneeIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", assigneeIds)
        : Promise.resolve({ data: [] }),
      supabase.from("call_outcomes" as any)
        .select("lead_id, outcome, notes, created_at")
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false }) as any,
    ]);

    const reqMap: Record<string, { event_type: string | null; event_date: string | null; event_time: string | null }> = {};
    for (const r of (reqs ?? []) as any[]) {
      if (!reqMap[r.lead_id]) reqMap[r.lead_id] = { event_type: r.event_type, event_date: r.event_date, event_time: r.start_time };
    }
    const profileMap: Record<string, string> = {};
    for (const p of (profiles ?? []) as any[]) profileMap[p.id] = p.full_name;

    const outcomeMap: Record<string, { outcome: string; notes: string | null }> = {};
    for (const o of (outcomes ?? []) as any[]) {
      if (!outcomeMap[o.lead_id]) outcomeMap[o.lead_id] = { outcome: o.outcome, notes: o.notes };
    }

    const all: Row[] = (data as any[]).map((f) => ({
      id: f.id,
      lead_id: f.lead_id,
      full_name: f.leads?.full_name ?? "—",
      phone: f.leads?.phone ?? "",
      company_id: f.leads?.company_id ?? "",
      lead_status: f.leads?.status ?? "new",
      event_type: reqMap[f.lead_id]?.event_type ?? null,
      event_date: reqMap[f.lead_id]?.event_date ?? null,
      event_time: reqMap[f.lead_id]?.event_time ?? null,
      scheduled_at: f.scheduled_at,
      is_sent: f.is_sent,
      assigned_to_name: f.leads?.assigned_to ? (profileMap[f.leads.assigned_to] ?? null) : null,
      last_outcome: outcomeMap[f.lead_id]?.outcome ?? null,
      last_outcome_note: outcomeMap[f.lead_id]?.notes ?? null,
    }));

    const now = Date.now();
    const sorted =
      filter === "everything" ? all.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
      : filter === "overdue" ? all.filter((r) => !r.is_sent && new Date(r.scheduled_at).getTime() < now)
      : filter === "upcoming" ? all.filter((r) => !r.is_sent && new Date(r.scheduled_at).getTime() >= now)
      : filter === "completed" ? all
      : all.sort((a, b) => {
          const aOver = new Date(a.scheduled_at).getTime() < now;
          const bOver = new Date(b.scheduled_at).getTime() < now;
          if (aOver !== bOver) return aOver ? 1 : -1;
          return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
        });
    setRows(sorted);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId, filter]);
  useDashboardRealtime(["follow_ups"], load);

  // Apply outcome filter on top of the main rows
  const displayRows = outcomeFilter === "all"
    ? rows
    : outcomeFilter === "no_outcome"
    ? rows.filter((r) => !r.last_outcome)
    : rows.filter((r) => r.last_outcome === outcomeFilter);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
      <div className="flex items-center gap-2">
        <Phone className="h-5 w-5" />
        <h1 className="text-xl font-semibold">Follow-ups</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={filter} onValueChange={(v) => navigate({ search: { filter: v as Filter } })}>
          <TabsList>
            <TabsTrigger value="everything">All</TabsTrigger>
            <TabsTrigger value="overdue">Overdue</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="all">All active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={outcomeFilter} onValueChange={(v) => setOutcomeFilter(v as OutcomeFilter)}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Filter by outcome" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All outcomes</SelectItem>
            <SelectItem value="callback_requested">Callback requested</SelectItem>
            <SelectItem value="interested">Interested</SelectItem>
            <SelectItem value="meeting_scheduled">Meeting scheduled</SelectItem>
            <SelectItem value="other">Other</SelectItem>
            <SelectItem value="not_interested">Not interested</SelectItem>
            <SelectItem value="no_outcome">No outcome yet</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : displayRows.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground text-center">No follow-ups in this view.</Card>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Lead name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Phone number</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Event type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Event date &amp; time</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Follow-up status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Follow-up time</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Last outcome</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Assigned to</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r) => {
                const overdue = !r.is_sent && new Date(r.scheduled_at).getTime() < Date.now();
                const eventDateTime = r.event_date
                  ? r.event_time
                    ? `${formatDateIN(r.event_date)} ${r.event_time}`
                    : formatDateIN(r.event_date)
                  : "—";
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      <Link to="/leads/$leadId" params={{ leadId: r.lead_id }} className="hover:underline">
                        {r.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.phone || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs capitalize text-muted-foreground">{r.lead_status.replace(/_/g, " ")}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.event_type || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{eventDateTime}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.is_sent ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                        </span>
                      ) : overdue ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                          <AlertCircle className="h-3.5 w-3.5" /> Overdue
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-success">Upcoming</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDateTimeIN(r.scheduled_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.last_outcome ? (
                        <OutcomeBadge outcome={r.last_outcome} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.assigned_to_name || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a href={`tel:${r.phone}`} title="Call"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md border hover:bg-accent transition-colors">
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                        <button type="button" title="WhatsApp" disabled={!r.phone}
                          onClick={() => { const u = buildWaMeLink(r.phone); if (u) openWaMeLink(u); }}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md border hover:bg-accent transition-colors disabled:opacity-40">
                          <MessageCircle className="h-3.5 w-3.5 text-success" />
                        </button>
                        <button type="button" title="Log call outcome"
                          onClick={() => setOutcomeDialogRow(r)}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md border hover:bg-accent transition-colors">
                          <PhoneCall className="h-3.5 w-3.5 text-primary" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Call outcome dialog */}
      {outcomeDialogRow && (
        <CallOutcomeDialog
          open={!!outcomeDialogRow}
          onOpenChange={(v) => { if (!v) setOutcomeDialogRow(null); }}
          leadId={outcomeDialogRow.lead_id}
          companyId={outcomeDialogRow.company_id}
          performedBy={profile?.id ?? null}
          onInterested={() => navTo({ to: "/leads/$leadId", params: { leadId: outcomeDialogRow.lead_id } })}
          onScheduleFollowUp={() => {
            const leadId = outcomeDialogRow.lead_id;
            setOutcomeDialogRow(null);
            setFollowUpLeadId(leadId);
          }}
          onScheduleMeeting={() => navTo({ to: "/leads/$leadId", params: { leadId: outcomeDialogRow.lead_id } })}
          onChanged={() => load()}
        />
      )}

      {/* Follow-up scheduler (opened after callback_requested outcome) */}
      {followUpLeadId && (
        <FollowUpDialog
          open={!!followUpLeadId}
          onOpenChange={(v) => { if (!v) setFollowUpLeadId(null); }}
          leadId={followUpLeadId}
          performedBy={profile?.id ?? null}
        />
      )}
    </div>
  );
}
