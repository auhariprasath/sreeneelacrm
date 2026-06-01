import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Phone, MessageSquare, Eye, EyeOff, Send, CalendarClock, ShieldAlert, ShieldOff, AlertTriangle, ArrowRightLeft, Lock, ClipboardList, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatPhoneIN, formatDateTimeIN, formatDateIN, formatTimeOfDay, initialsOf, relativeTime } from "@/lib/format";
import { StatusBadge, ScoreBadge } from "@/components/leads/lead-badges";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CallOutcomeDialog } from "@/components/leads/call-outcome-dialog";
import { FollowUpDialog } from "@/components/leads/follow-up-dialog";
import { BlacklistDialog } from "@/components/leads/blacklist-dialog";
import { TransferDialog } from "@/components/leads/transfer-dialog";
import { RequirementSheet } from "@/components/requirements/requirement-sheet";
import { DecisionDialog } from "@/components/requirements/decision-dialog";
import type { Database } from "@/integrations/supabase/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Activity = Database["public"]["Tables"]["activity_logs"]["Row"];
type FollowUp = Database["public"]["Tables"]["follow_ups"]["Row"];
type Requirement = Database["public"]["Tables"]["requirements"]["Row"];
type Status = Database["public"]["Enums"]["lead_status"];

export const Route = createFileRoute("/_app/leads/$leadId")({ component: LeadProfile });

const STATUS_OPTS: Status[] = ["new","in_progress","neutral","positive","negative","unresponsive","closed","locked"];

function LeadProfile() {
  const { leadId } = Route.useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [unmasked, setUnmasked] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [referrer, setReferrer] = useState<{ id: string; full_name: string } | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [requirements, setRequirements] = useState<Requirement[]>([]);

  const [callOpen, setCallOpen] = useState(false);
  const [fuOpen, setFuOpen] = useState(false);
  const [blOpen, setBlOpen] = useState(false);
  const [trOpen, setTrOpen] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const [editReqId, setEditReqId] = useState<string | null>(null);
  const [decisionReqId, setDecisionReqId] = useState<string | null>(null);

  const loadRequirements = async () => {
    const { data } = await supabase
      .from("requirements").select("*").eq("lead_id", leadId)
      .is("deleted_at", null).order("requirement_number", { ascending: true });
    setRequirements((data as Requirement[]) ?? []);
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
    if (error || !data) { toast.error("Lead not found"); navigate({ to: "/leads" }); return; }
    setLead(data as Lead);

    await supabase.from("activity_logs").insert({
      lead_id: leadId, action: "Viewed lead", action_type: "view", performed_by: profile?.id ?? null,
    });

    const [{ data: acts }, { data: fus }, { data: reqs }] = await Promise.all([
      supabase.from("activity_logs").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(50),
      supabase.from("follow_ups").select("*").eq("lead_id", leadId).is("deleted_at", null).order("scheduled_at", { ascending: true }),
      supabase.from("requirements").select("*").eq("lead_id", leadId).is("deleted_at", null).order("requirement_number", { ascending: true }),
    ]);
    setActivities((acts as Activity[]) ?? []);
    setFollowUps((fus as FollowUp[]) ?? []);
    setRequirements((reqs as Requirement[]) ?? []);

    if ((data as Lead).referred_by_lead_id) {
      const { data: ref } = await supabase.from("leads").select("id,full_name").eq("id", (data as Lead).referred_by_lead_id!).maybeSingle();
      setReferrer(ref ?? null);
    } else {
      setReferrer(null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [leadId]);

  useEffect(() => {
    const ch = supabase.channel(`lead-${leadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs", filter: `lead_id=eq.${leadId}` },
        (p) => setActivities((prev) => [p.new as Activity, ...prev]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads", filter: `id=eq.${leadId}` },
        (p) => setLead(p.new as Lead))
      .on("postgres_changes", { event: "*", schema: "public", table: "follow_ups", filter: `lead_id=eq.${leadId}` },
        async () => {
          const { data: fus } = await supabase.from("follow_ups").select("*").eq("lead_id", leadId).is("deleted_at", null).order("scheduled_at", { ascending: true });
          setFollowUps((fus as FollowUp[]) ?? []);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [leadId]);

  const updateStatus = async (s: Status) => {
    if (!lead) return;
    const prev = lead.status;
    setLead({ ...lead, status: s });
    const { error } = await supabase.from("leads").update({ status: s }).eq("id", lead.id);
    if (error) { setLead({ ...lead, status: prev }); toast.error(error.message); return; }
    await supabase.from("activity_logs").insert({
      lead_id: lead.id, action: `Status changed: ${prev} → ${s}`, action_type: "status_change", performed_by: profile?.id ?? null,
    });
    toast.success("Status updated");
  };

  const addNote = async () => {
    if (!note.trim() || !lead) return;
    setSaving(true);
    const { error } = await supabase.from("activity_logs").insert({
      lead_id: lead.id, action: "Note added", note: note.trim(), action_type: "note", performed_by: profile?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setNote("");
    toast.success("Note added");
  };

  const markFollowUpDone = async (id: string) => {
    const { error } = await supabase.from("follow_ups").update({ is_sent: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("activity_logs").insert({
      lead_id: leadId, action: "Follow-up marked done", action_type: "system", performed_by: profile?.id ?? null,
    });
  };

  if (loading || !lead) {
    return <div className="text-sm text-muted-foreground">Loading lead…</div>;
  }

  const masked = (profile?.phone_masked ?? false) && !unmasked;
  const tel = (lead.phone || "").replace(/\D/g, "").slice(-10);
  const upcomingFu = followUps.find((f) => !f.is_sent);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <Link to="/leads" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>

      {/* Locked banner */}
      {lead.status === "locked" && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 rounded-lg p-3 flex items-start gap-2">
          <Lock className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium">Lead locked</div>
            <div className="text-xs opacity-90 mt-0.5">A transfer request is pending review. Edits are restricted until it is approved or rejected.</div>
          </div>
        </div>
      )}

      {/* Blacklist banner */}
      {lead.is_blacklisted && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium">Blacklisted across all companies</div>
            {lead.blacklist_reason && <div className="text-xs opacity-90 mt-0.5">Reason: {lead.blacklist_reason}</div>}
          </div>
        </div>
      )}

      {/* Referrer banner */}
      {referrer && (
        <div className="bg-card border rounded-lg p-3 text-sm">
          Referred by{" "}
          <Link to="/leads/$leadId" params={{ leadId: referrer.id }} className="text-primary font-medium hover:underline">
            {referrer.full_name}
          </Link>
        </div>
      )}

      {/* Header card */}
      <div className="bg-card border rounded-lg p-4 md:p-5">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback>{initialsOf(lead.full_name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-semibold truncate">{lead.full_name}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                  <span>{formatPhoneIN(lead.phone, masked)}</span>
                  {profile?.phone_masked && (
                    <button onClick={() => setUnmasked((v) => !v)} className="hover:text-foreground" aria-label="Toggle phone">
                      {unmasked ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>
              <ScoreBadge score={lead.lead_score} />
            </div>

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <StatusBadge status={lead.status} />
              <span className="text-[11px] text-muted-foreground">Updated {relativeTime(lead.updated_at)}</span>
              {upcomingFu && (
                <span className="text-[11px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-full px-2 py-0.5">
                  Follow-up: {formatDateTimeIN(upcomingFu.scheduled_at)}
                </span>
              )}
            </div>

            <div className="mt-4 flex gap-2 flex-wrap">
              <a
                href={`tel:+91${tel}`}
                onClick={() => setTimeout(() => setCallOpen(true), 400)}
                className="inline-flex items-center gap-2 h-11 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium"
              >
                <Phone className="h-4 w-4" /> Call
              </a>
              <a href={`https://wa.me/91${tel}`} target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-2 h-11 px-4 rounded-md bg-emerald-600 text-white text-sm font-medium">
                <MessageSquare className="h-4 w-4" /> WhatsApp
              </a>
              <Button variant="outline" className="h-11" onClick={() => setFuOpen(true)}>
                <CalendarClock className="h-4 w-4 mr-1.5" /> Follow-up
              </Button>
              <Button
                variant="outline"
                className={`h-11 ${lead.is_blacklisted ? "" : "text-rose-700 dark:text-rose-300 border-rose-500/40"}`}
                onClick={() => setBlOpen(true)}
              >
                {lead.is_blacklisted
                  ? (<><ShieldOff className="h-4 w-4 mr-1.5" /> Unblock</>)
                  : (<><ShieldAlert className="h-4 w-4 mr-1.5" /> Blacklist</>)}
              </Button>
              <Button variant="outline" className="h-11" onClick={() => setTrOpen(true)} disabled={lead.status === "locked"}>
                <ArrowRightLeft className="h-4 w-4 mr-1.5" /> Transfer
              </Button>
              <div className="ml-auto min-w-[180px]">
                <Select value={lead.status} onValueChange={(v) => updateStatus(v as Status)}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTS.map((s) => <SelectItem key={s} value={s}>{s.replace("_"," ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          <TabsTrigger value="notes">Note</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3 pt-3">
          <InfoRow label="Language" value={lead.language} />
          <InfoRow label="Source" value={lead.source.replace("_"," ")} />
          <InfoRow label="Score" value={lead.lead_score} />
          <InfoRow label="Follow-up attempts" value={`${lead.follow_up_count} / ${lead.max_follow_up_attempts}`} />
          {lead.referred_by_name && !referrer && (
            <InfoRow label="Referred by (name)" value={lead.referred_by_name} />
          )}
          {lead.notes && (
            <div className="bg-card border rounded-md p-3">
              <div className="text-[11px] text-muted-foreground mb-1">Initial notes</div>
              <div className="text-sm whitespace-pre-wrap">{lead.notes}</div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="requirements" className="pt-3 space-y-2">
          <Button
            onClick={() => { setEditReqId(null); setReqOpen(true); }}
            className="min-h-11"
            disabled={lead.status === "locked" || lead.is_blacklisted}
          >
            <Plus className="h-4 w-4 mr-1.5" /> New requirement
          </Button>
          {requirements.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No requirements yet. Capture one to check slot availability.</div>
          ) : (
            <div className="space-y-2">
              {requirements.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setEditReqId(r.id); setReqOpen(true); }}
                  className="w-full text-left bg-card border rounded-md p-3 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium flex items-center gap-2">
                        <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                        Requirement #{r.requirement_number}
                        {r.event_type && <span className="text-muted-foreground font-normal">· {r.event_type}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {r.event_date ? formatDateIN(r.event_date) : "Date TBD"}
                        {r.start_time && ` · ${formatTimeOfDay(r.start_time)}`}
                        {r.end_time && ` – ${formatTimeOfDay(r.end_time)}`}
                      </div>
                    </div>
                    <span className="text-[11px] uppercase tracking-wide bg-muted text-muted-foreground rounded-full px-2 py-0.5 shrink-0">
                      {r.status.replace("_", " ")}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>



        <TabsContent value="activity" className="pt-3">
          {activities.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No activity yet.</div>
          ) : (
            <ol className="relative border-l ml-2 space-y-4">
              {activities.map((a) => (
                <li key={a.id} className="pl-4 relative">
                  <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="text-sm font-medium">{a.action}</div>
                  {a.note && <div className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{a.note}</div>}
                  <div className="text-[11px] text-muted-foreground mt-1">{formatDateTimeIN(a.created_at)}</div>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="followups" className="pt-3 space-y-2">
          <Button onClick={() => setFuOpen(true)} className="min-h-11">
            <CalendarClock className="h-4 w-4 mr-1.5" /> Schedule follow-up
          </Button>
          {followUps.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No follow-ups yet.</div>
          ) : (
            <div className="space-y-2">
              {followUps.map((f) => (
                <div key={f.id} className="bg-card border rounded-md p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{formatDateTimeIN(f.scheduled_at)}</div>
                    {f.note && <div className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{f.note}</div>}
                    {f.is_sent && <div className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1">✓ Done</div>}
                  </div>
                  {!f.is_sent && (
                    <Button size="sm" variant="ghost" onClick={() => markFollowUpDone(f.id)}>Mark done</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="pt-3 space-y-2">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Type a note about this lead…" />
          <Button onClick={addNote} disabled={saving || !note.trim()} className="min-h-11">
            <Send className="h-4 w-4 mr-1.5" /> {saving ? "Saving…" : "Add note"}
          </Button>
        </TabsContent>
      </Tabs>

      <CallOutcomeDialog
        open={callOpen}
        onOpenChange={setCallOpen}
        leadId={lead.id}
        currentFollowUpCount={lead.follow_up_count}
        maxFollowUpAttempts={lead.max_follow_up_attempts}
        performedBy={profile?.id ?? null}
        onScheduleFollowUp={() => setFuOpen(true)}
      />
      <FollowUpDialog
        open={fuOpen}
        onOpenChange={setFuOpen}
        leadId={lead.id}
        performedBy={profile?.id ?? null}
      />
      <BlacklistDialog
        open={blOpen}
        onOpenChange={setBlOpen}
        leadId={lead.id}
        performedBy={profile?.id ?? null}
        alreadyBlacklisted={lead.is_blacklisted}
        currentReason={lead.blacklist_reason}
        onDone={() => { /* realtime will refresh */ }}
      />
      <TransferDialog
        open={trOpen}
        onOpenChange={setTrOpen}
        leadId={lead.id}
        fromCompanyId={lead.company_id}
        performedBy={profile?.id ?? null}
      />
      <RequirementSheet
        open={reqOpen}
        onOpenChange={(v) => { setReqOpen(v); if (!v) loadRequirements(); }}
        leadId={lead.id}
        companyId={lead.company_id}
        requirementId={editReqId}
        onSaved={loadRequirements}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center bg-card border rounded-md px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium capitalize">{value}</span>
    </div>
  );
}
