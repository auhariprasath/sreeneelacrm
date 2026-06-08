import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { InfoTip } from "@/components/ui/info-tip";
import { ArrowLeft, Phone, MessageSquare, Mail, Eye, EyeOff, Send, CalendarClock, ShieldAlert, ShieldOff, AlertTriangle, ArrowRightLeft, Lock, ClipboardList, Plus, FileText, CheckCircle2, IndianRupee, Building2, CreditCard, MoreVertical, XCircle, Star } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatPhoneIN, formatDateTimeIN, formatDateIN, formatTimeOfDay, initialsOf, relativeTime, formatINR } from "@/lib/format";
import { buildWaMeLink, openWaMeLink } from "@/lib/utils";
import { StatusBadge, ScoreBadge } from "@/components/leads/lead-badges";

import { CallOutcomeDialog } from "@/components/leads/call-outcome-dialog";
import { FollowUpDialog } from "@/components/leads/follow-up-dialog";
import { BlacklistDialog } from "@/components/leads/blacklist-dialog";
import { TransferDialog } from "@/components/leads/transfer-dialog";
import { RequirementSheet } from "@/components/requirements/requirement-sheet";
import { DecisionDialog } from "@/components/requirements/decision-dialog";
import { QuotationBuilder } from "@/components/quotations/quotation-builder";
import { SendQuotationDialog } from "@/components/quotations/send-quotation-dialog";
import { InvoiceRowMenu } from "@/components/quotations/invoice-row-menu";
import { BookingConfirmDialog } from "@/components/bookings/booking-confirm-dialog";
import { BookingConfirmationDialog } from "@/components/bookings/booking-confirmation-dialog";
import { PaymentReceivedDialog } from "@/components/bookings/payment-received-dialog";
import { InvoicePaymentCard } from "@/components/bookings/invoice-payment-card";
import { generateInvoiceForQuotation, markInvoiceSent, downloadInvoicePdf } from "@/lib/invoice-actions";
import { ChequeClearDialog, CancelBookingDialog, RescheduleBookingDialog } from "@/components/bookings/booking-actions";
import { EventCompleteDialog } from "@/components/bookings/event-complete-dialog";
import { RemindersList } from "@/components/bookings/reminders-list";
import { VendorAssignment } from "@/components/bookings/vendor-assignment";
import { EventDayLogs } from "@/components/bookings/event-day-logs";
import { PaymentCredentialsDialog } from "@/components/leads/payment-credentials-dialog";
import { MeetingSchedulerDialog } from "@/components/leads/meeting-scheduler-dialog";
import { BookingTasksList } from "@/components/tasks/booking-tasks-list";
import { BookingAssignedTo } from "@/components/bookings/booking-assigned-to";
import { CoordinatorAssign } from "@/components/bookings/coordinator-assign";
import { CoordinationProgress } from "@/components/bookings/coordination-progress";
import { SourcesTab } from "@/components/leads/sources-tab";
import { QuotationStatusBadge } from "@/components/quotations/quotation-status-badge";
import type { Database } from "@/integrations/supabase/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Activity = Database["public"]["Tables"]["activity_logs"]["Row"];
type FollowUp = Database["public"]["Tables"]["follow_ups"]["Row"];
type Requirement = Database["public"]["Tables"]["requirements"]["Row"];
type Quotation = Database["public"]["Tables"]["quotations"]["Row"];
type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Payment = Database["public"]["Tables"]["payments"]["Row"];


export const Route = createFileRoute("/_app/leads/$leadId")({ component: LeadProfile });



function LeadProfile() {
  const { leadId } = Route.useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [unmasked, setUnmasked] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [venueMeetings, setVenueMeetings] = useState<Array<{ id: string; scheduled_date: string; scheduled_time: string; status: string; contact_person_name: string | null; notes: string | null }>>([]);
  const [referrer, setReferrer] = useState<{ id: string; full_name: string } | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [winLoss, setWinLoss] = useState<{ outcome: string; drop_reason: string | null; competitor_name: string | null; amount_value: number | null; closed_at: string }[]>([]);
  const [rejectedTransfer, setRejectedTransfer] = useState<{ rejection_reason: string | null; updated_at: string; to_name: string } | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);

  const [callOpen, setCallOpen] = useState(false);
  const [fuOpen, setFuOpen] = useState(false);
  const [blOpen, setBlOpen] = useState(false);
  const [trOpen, setTrOpen] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const [editReqId, setEditReqId] = useState<string | null>(null);
  const [decisionReqId, setDecisionReqId] = useState<string | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteReqId, setQuoteReqId] = useState<string | null>(null);
  const [editQuoteId, setEditQuoteId] = useState<string | null>(null);
  const [reviseQuoteId, setReviseQuoteId] = useState<string | null>(null);
  const [sendQuoteId, setSendQuoteId] = useState<string | null>(null);
  const [bookQuoteId, setBookQuoteId] = useState<string | null>(null);
  const [chequeBooking, setChequeBooking] = useState<Booking | null>(null);
  const [cancelBooking, setCancelBooking] = useState<Booking | null>(null);
  const [reschedBooking, setReschedBooking] = useState<Booking | null>(null);
  const [completeBooking, setCompleteBooking] = useState<Booking | null>(null);
  const [confirmationBookingId, setConfirmationBookingId] = useState<string | null>(null);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [payCredsBooking, setPayCredsBooking] = useState<Booking | null>(null);
  const [payCredsOpen, setPayCredsOpen] = useState(false);
  const [paymentReceivedQuoteId, setPaymentReceivedQuoteId] = useState<string | null>(null);
  const [paymentReceivedMethod, setPaymentReceivedMethod] = useState<"cash" | "cheque" | "bank_transfer" | "upi" | "razorpay">("cash");
  const [generatingInvoiceFor, setGeneratingInvoiceFor] = useState<string | null>(null);
  

  const loadRequirements = async () => {
    const { data } = await supabase
      .from("requirements").select("*").eq("lead_id", leadId)
      .is("deleted_at", null).order("requirement_number", { ascending: true });
    setRequirements((data as Requirement[]) ?? []);
  };

  const loadQuotations = async () => {
    const { data } = await supabase
      .from("quotations").select("*").eq("lead_id", leadId)
      .is("deleted_at", null).order("version", { ascending: false });
    setQuotations((data as Quotation[]) ?? []);
  };

  const loadBookings = async () => {
    const [{ data: bks }, { data: pmts }] = await Promise.all([
      supabase.from("bookings").select("*").eq("lead_id", leadId).is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("payments").select("*").eq("lead_id", leadId).is("deleted_at", null).order("created_at", { ascending: true }),
    ]);
    setBookings((bks as Booking[]) ?? []);
    setPayments((pmts as Payment[]) ?? []);
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
    if (error || !data) { toast.error("Lead not found"); navigate({ to: "/leads" }); return; }
    setLead(data as Lead);

    await supabase.from("activity_logs").insert({
      lead_id: leadId, action: "Viewed lead", action_type: "view", performed_by: profile?.id ?? null,
    });

    const [{ data: acts }, { data: fus }, { data: reqs }, { data: quotes }, { data: bks }, { data: pmts }, { data: wls }] = await Promise.all([
      supabase.from("activity_logs").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(50),
      supabase.from("follow_ups").select("*").eq("lead_id", leadId).is("deleted_at", null).order("scheduled_at", { ascending: true }),
      supabase.from("requirements").select("*").eq("lead_id", leadId).is("deleted_at", null).order("requirement_number", { ascending: true }),
      supabase.from("quotations").select("*").eq("lead_id", leadId).is("deleted_at", null).order("version", { ascending: false }),
      supabase.from("bookings").select("*").eq("lead_id", leadId).is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("payments").select("*").eq("lead_id", leadId).is("deleted_at", null).order("created_at", { ascending: true }),
      supabase.from("win_loss_log").select("outcome, drop_reason, competitor_name, amount_value, closed_at").eq("lead_id", leadId).order("closed_at", { ascending: false }),
    ]);
    setActivities((acts as Activity[]) ?? []);
    // Sort: active (not sent, not cancelled) first — most recently created at top — then completed/cancelled by date.
    const sortedFus = ((fus as FollowUp[]) ?? []).slice().sort((a, b) => {
      const aActive = !a.is_sent && !(a as any).is_cancelled;
      const bActive = !b.is_sent && !(b as any).is_cancelled;
      if (aActive !== bActive) return aActive ? -1 : 1;
      if (aActive) return new Date(b.created_at as any).getTime() - new Date(a.created_at as any).getTime();
      return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
    });
    setFollowUps(sortedFus);
    setRequirements((reqs as Requirement[]) ?? []);
    setQuotations((quotes as Quotation[]) ?? []);
    setBookings((bks as Booking[]) ?? []);
    setPayments((pmts as Payment[]) ?? []);
    setWinLoss((wls as any[]) ?? []);

    // Latest rejected transfer (only show if it's still the most recent transfer for this lead)
    const { data: lastTransfer } = await supabase
      .from("transfer_requests")
      .select("status, rejection_reason, updated_at, to_company_id")
      .eq("lead_id", leadId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastTransfer && lastTransfer.status === "rejected") {
      const toName = (data as Lead).company_id
        ? (await supabase.from("companies").select("name").eq("id", lastTransfer.to_company_id).maybeSingle()).data?.name ?? "another company"
        : "another company";
      setRejectedTransfer({
        rejection_reason: lastTransfer.rejection_reason,
        updated_at: lastTransfer.updated_at,
        to_name: toName,
      });
    } else {
      setRejectedTransfer(null);
    }

    if ((data as Lead).referred_by_lead_id) {
      const { data: ref } = await supabase.from("leads").select("id,full_name").eq("id", (data as Lead).referred_by_lead_id!).maybeSingle();
      setReferrer(ref ?? null);
    } else {
      setReferrer(null);
    }

    const { data: cust } = await supabase.from("customers").select("id").eq("lead_id", leadId).maybeSingle();
    setCustomerId((cust as any)?.id ?? null);

    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [leadId]);

  useEffect(() => {
    const reloadList = async (table: "quotations" | "bookings" | "payments" | "requirements") => {
      const q = supabase.from(table).select("*").eq("lead_id", leadId).is("deleted_at", null);
      const order = table === "quotations" ? q.order("version", { ascending: false })
        : table === "bookings" ? q.order("created_at", { ascending: false })
        : table === "payments" ? q.order("created_at", { ascending: true })
        : q.order("requirement_number", { ascending: true });
      const { data } = await order;
      if (table === "quotations") setQuotations((data as Quotation[]) ?? []);
      else if (table === "bookings") setBookings((data as Booking[]) ?? []);
      else if (table === "payments") setPayments((data as Payment[]) ?? []);
      else setRequirements((data as Requirement[]) ?? []);
    };

    const ch = supabase.channel(`lead-${leadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs", filter: `lead_id=eq.${leadId}` },
        (p) => setActivities((prev) => [p.new as Activity, ...prev]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads", filter: `id=eq.${leadId}` },
        (p) => setLead(p.new as Lead))
      .on("postgres_changes", { event: "*", schema: "public", table: "follow_ups", filter: `lead_id=eq.${leadId}` },
        async () => {
          const { data: fus } = await supabase.from("follow_ups").select("*").eq("lead_id", leadId).is("deleted_at", null).order("scheduled_at", { ascending: true });
          const sorted = ((fus as FollowUp[]) ?? []).slice().sort((a, b) => {
            const aActive = !a.is_sent && !(a as any).is_cancelled;
            const bActive = !b.is_sent && !(b as any).is_cancelled;
            if (aActive !== bActive) return aActive ? -1 : 1;
            if (aActive) return new Date(b.created_at as any).getTime() - new Date(a.created_at as any).getTime();
            return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
          });
          setFollowUps(sorted);
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "quotations", filter: `lead_id=eq.${leadId}` }, () => reloadList("quotations"))
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `lead_id=eq.${leadId}` }, () => reloadList("bookings"))
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `lead_id=eq.${leadId}` }, () => reloadList("payments"))
      .on("postgres_changes", { event: "*", schema: "public", table: "requirements", filter: `lead_id=eq.${leadId}` }, () => reloadList("requirements"))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [leadId]);

  // Manual status updates removed — status changes are driven by call outcomes & lifecycle events.


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
  const upcomingFu = followUps.find((f) => !f.is_sent && !(f as any).is_cancelled);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <Link to="/leads" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>

      {/* Locked banner */}
      {lead.status === "locked" && (
        <div className="bg-warning/10 border border-warning/30 text-warning dark:text-warning rounded-lg p-3 flex items-start gap-2">
          <Lock className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium">Lead locked</div>
            <div className="text-xs opacity-90 mt-0.5">A transfer request is pending review. Edits are restricted until it is approved or rejected.</div>
          </div>
        </div>
      )}

      {/* Rejected transfer banner */}
      {rejectedTransfer && lead.status !== "locked" && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive dark:text-destructive rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium">Transfer to {rejectedTransfer.to_name} was rejected</div>
            {rejectedTransfer.rejection_reason && (
              <div className="text-xs opacity-90 mt-0.5">Reason: {rejectedTransfer.rejection_reason}</div>
            )}
            <div className="text-[11px] opacity-75 mt-0.5">{formatDateTimeIN(rejectedTransfer.updated_at)}</div>
          </div>
        </div>
      )}

      {/* Flag banner */}
      {lead.is_blacklisted && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive dark:text-destructive rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium flex items-center">Flagged — do not contact (all companies)<InfoTip tip="flagContact" /></div>
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
                {(lead as any).email && (
                  <a
                    href={`mailto:${(lead as any).email}`}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 hover:text-foreground hover:underline w-fit"
                  >
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{(lead as any).email}</span>
                  </a>
                )}
              </div>
              <ScoreBadge score={lead.lead_score} />
            </div>

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <StatusBadge status={lead.status} />
              <span className="text-[11px] text-muted-foreground">Updated {relativeTime(lead.updated_at)}</span>
              {upcomingFu && (
                <span className="text-[11px] bg-warning/15 text-warning dark:text-warning border border-warning/30 rounded-full px-2 py-0.5">
                  Follow-up: {formatDateTimeIN(upcomingFu.scheduled_at)}
                </span>
              )}
              {customerId && (
                <Link to="/customers/$customerId" params={{ customerId }}
                  className="text-[11px] bg-primary/10 text-primary border border-primary/30 rounded-full px-2 py-0.5 hover:bg-primary/20 inline-flex items-center gap-1">
                  <Star className="h-3 w-3" /> Customer profile
                </Link>
              )}
            </div>

            <div className="mt-4 flex gap-2 flex-wrap">
              <a
                href={`tel:+91${tel}`}
                onClick={() => {
                  // Only show "How did the call go?" on the first call (when lead is still new)
                  if (lead.status === "new") {
                    setTimeout(() => setCallOpen(true), 400);
                  }
                }}
                className="inline-flex items-center gap-2 h-11 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium"
              >
                <Phone className="h-4 w-4" /> Call
              </a>
              <button type="button"
                 onClick={() => {
                   const wa = buildWaMeLink(lead.phone);
                   if (wa) openWaMeLink(wa);
                   supabase.from("activity_logs").insert({
                     lead_id: lead.id,
                     action: `WhatsApp opened by ${profile?.full_name ?? "staff"}`,
                     action_type: "system",
                     performed_by: profile?.id ?? null,
                   }).then(() => {});
                 }}
                 className="inline-flex items-center gap-2 h-11 px-4 rounded-md bg-success text-white text-sm font-medium">
                <MessageSquare className="h-4 w-4" /> WhatsApp
              </button>
              <Button variant="outline" className="h-11" onClick={() => setFuOpen(true)}>
                <CalendarClock className="h-4 w-4 mr-1.5" /> Follow-up
              </Button>
              <Button variant="outline" className="h-11" onClick={() => setMeetingOpen(true)}>
                <Building2 className="h-4 w-4 mr-1.5" /> Venue meeting
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-11 w-11 p-0" aria-label="More actions">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => setTrOpen(true)} disabled={lead.status === "locked"}>
                    <ArrowRightLeft className="h-4 w-4 mr-2" /> Move to another team
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setBlOpen(true)} className={lead.is_blacklisted ? "" : "text-destructive dark:text-destructive focus:text-destructive"}>
                    {lead.is_blacklisted
                      ? (<><ShieldOff className="h-4 w-4 mr-2" /> Remove flag</>)
                      : (<><ShieldAlert className="h-4 w-4 mr-2" /> Flag — do not contact</>)}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6 text-[11px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="requirements">Reqs</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          <TabsTrigger value="notes">Note</TabsTrigger>
        </TabsList>

        <TabsContent value="sources">
          <SourcesTab leadId={lead.id} source={lead.source} createdAt={lead.created_at} createdBy={lead.created_by} />
        </TabsContent>

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
          {winLoss.length > 0 && (
            <div className="bg-card border rounded-md p-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">Outcomes history</div>
              {winLoss.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${w.outcome === "won" ? "bg-success/15 text-success dark:text-success" : "bg-destructive/15 text-destructive dark:text-destructive"}`}>
                    {w.outcome}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground">
                      {w.amount_value != null && <span className="font-medium">{formatINR(Number(w.amount_value))}</span>}
                      {w.drop_reason && <span className="text-muted-foreground"> · {w.drop_reason}</span>}
                      {w.competitor_name && <span className="text-muted-foreground"> · lost to {w.competitor_name}</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{formatDateIN(w.closed_at)}</div>
                  </div>
                </div>
              ))}
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
                <div key={r.id} className="bg-card border rounded-md p-3 hover:border-primary/40 transition-colors">
                  <button
                    onClick={() => { setEditReqId(r.id); setReqOpen(true); }}
                    className="w-full text-left"
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
                  <div className="mt-2 flex gap-2 justify-end flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => setDecisionReqId(r.id)} disabled={lead.status === "locked"}>
                      Record decision
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setQuoteReqId(r.id);
                        setEditQuoteId(null);
                        setReviseQuoteId(null);
                        setQuoteOpen(true);
                      }}
                      disabled={lead.status === "locked"}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" /> Quotation
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quotations card */}
          {quotations.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Quotations</div>
              <div className="space-y-2">
                {quotations.map((q) => {
                  const hasBooking = bookings.some((b) => b.quotation_id === q.id);
                  const approved = q.status === "agreed";
                  const invoiceGenerated = !!q.invoice_generated_at;
                  const invoiceSent = !!q.invoice_sent_at;
                  const showGenerate = approved && !hasBooking && !invoiceGenerated;
                  const showSendInvoice = approved && !hasBooking && invoiceGenerated && !invoiceSent;
                  const showPaymentCard = approved && !hasBooking && invoiceSent;
                  const openBuilder = () => { setQuoteReqId(q.requirement_id); setEditQuoteId(q.id); setReviseQuoteId(null); setQuoteOpen(true); };

                  const handleGenerateInvoice = async (e?: { stopPropagation?: () => void }) => {
                    e?.stopPropagation?.();
                    setGeneratingInvoiceFor(q.id);
                    try {
                      const res = await generateInvoiceForQuotation(q.id, profile?.id ?? null);
                      if (!res) { toast.error("Couldn't generate invoice"); return; }
                      toast.success(`Invoice ${res.invoice_number} generated`);
                      loadQuotations();
                    } finally { setGeneratingInvoiceFor(null); }
                  };

                  const handleSendInvoice = async (e?: { stopPropagation?: () => void }) => {
                    e?.stopPropagation?.();
                    const lead = await supabase.from("leads").select("phone,full_name").eq("id", leadId).maybeSingle();
                    const phone = lead.data?.phone;
                    if (!phone) { toast.error("Lead has no phone number"); return; }
                    const url = `${window.location.origin}/invoice/${(q as any).public_token}`;
                    const company = await supabase.from("companies").select("name").eq("id", q.company_id).maybeSingle();
                    const msg = `Hi ${lead.data?.full_name ?? ""}, your invoice ${q.invoice_number} from ${company.data?.name ?? ""} is ready.\n\nAmount: ${formatINR(Number(q.total))}\n\nView & download: ${url}\n\nReply once payment is done. Thank you!`;
                    const wa = buildWaMeLink(phone, msg);
                    if (!wa) { toast.error("Invalid phone number"); return; }
                    // Also download the PDF so staff can attach it
                    downloadInvoicePdf(q.id).catch(() => {});
                    openWaMeLink(wa);
                    await markInvoiceSent(q.id, profile?.id ?? null);
                    toast.success("Invoice sent · WhatsApp opened");
                    loadQuotations();
                  };

                  return (
                    <div key={q.id} className="space-y-2">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={openBuilder}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openBuilder(); } }}
                        className="bg-card border rounded-md p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/30 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            v{q.version} · {formatINR(Number(q.total))}
                            <QuotationStatusBadge quotation={q} />
                            {q.invoice_number && (
                              <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-primary/10 text-primary">
                                {q.invoice_number}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {q.is_peak_season && <span className="text-warning dark:text-warning">Peak · </span>}
                            Updated {relativeTime(q.updated_at)}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {(q as any).viewed_at && (
                              <span className="text-[10px] text-muted-foreground">
                                Viewed {relativeTime((q as any).viewed_at)}{(q as any).view_count > 1 ? ` · ${(q as any).view_count}×` : ""}
                              </span>
                            )}
                            {((q as any).approved_at || q.agreed_at) && (
                              <span className="text-[10px] text-success dark:text-success">
                                · Approved {relativeTime((q as any).approved_at ?? q.agreed_at)}
                              </span>
                            )}
                            {invoiceSent && (
                              <span className="text-[10px] text-success dark:text-success">
                                · Invoice sent {relativeTime(q.invoice_sent_at!)}
                              </span>
                            )}
                            {(q as any).public_token && (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const url = invoiceGenerated
                                    ? `${window.location.origin}/invoice/${(q as any).public_token}`
                                    : `${window.location.origin}/quotation/${(q as any).public_token}`;
                                  await navigator.clipboard.writeText(url);
                                  toast.success(invoiceGenerated ? "Invoice link copied" : "Quotation link copied");
                                }}
                                className="text-[10px] underline text-muted-foreground hover:text-foreground"
                              >
                                Copy link
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {["sent", "agreed", "declined"].includes(q.status) && !invoiceGenerated && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setQuoteReqId(q.requirement_id); setEditQuoteId(null); setReviseQuoteId(q.id); setQuoteOpen(true); }}
                              className="border-warning/50 text-warning dark:text-warning hover:bg-warning/10"
                            >
                              Revise
                            </Button>
                          )}
                          {showGenerate ? (
                            <>
                              <Button
                                size="sm"
                                onClick={handleGenerateInvoice}
                                disabled={generatingInvoiceFor === q.id}
                                className="bg-success hover:bg-success text-white shadow-sm"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                {generatingInvoiceFor === q.id ? "Generating…" : "Generate invoice"}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setBookQuoteId(q.id)} title="Advanced: instalments / partial advance / cheque">
                                Advanced…
                              </Button>
                            </>
                          ) : showSendInvoice ? (
                            <Button size="sm" onClick={handleSendInvoice} className="bg-success hover:bg-success text-white">
                              <Send className="h-3.5 w-3.5 mr-1" /> Send invoice
                            </Button>
                          ) : !invoiceGenerated ? (
                            <Button size="sm" onClick={() => setSendQuoteId(q.id)}>
                              <Send className="h-3.5 w-3.5 mr-1" /> Send
                            </Button>
                          ) : null}
                          <InvoiceRowMenu
                            quotationId={q.id}
                            leadId={leadId}
                            pdfUrl={q.pdf_url}
                            versionLabel={`v${q.version}`}
                            onView={openBuilder}
                            onResend={() => invoiceGenerated ? handleSendInvoice() : setSendQuoteId(q.id)}
                            onDeleted={loadQuotations}
                          />
                        </div>
                      </div>
                      {showPaymentCard && (
                        <InvoicePaymentCard
                          quotation={q}
                          onPaymentReceived={(qid, method) => {
                            setPaymentReceivedQuoteId(qid);
                            setPaymentReceivedMethod(method);
                          }}
                          onChanged={loadQuotations}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bookings card */}
          {bookings.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Bookings</div>
              <div className="space-y-2">
                {bookings.map((b) => {
                  const bookingPayments = payments.filter((p) => p.booking_id === b.id);
                  const pending = bookingPayments.filter((p) => p.status === "pending");
                  const eventTs = new Date(`${b.event_date}T00:00:00`).getTime();
                  const todayTs = new Date(new Date().toDateString()).getTime();
                  const daysToEvent = Math.round((eventTs - todayTs) / 86400000);
                  const showEventDayLogs = daysToEvent <= 1 && daysToEvent >= -1;
                  const rescheduled = b.status === "rescheduled" && b.rescheduled_from_date;
                  return (
                    <div key={b.id} className="bg-card border rounded-md p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                            {formatDateIN(b.event_date)}
                            {b.start_time && ` · ${formatTimeOfDay(b.start_time)}`}
                            <span className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 ${b.status === "confirmed" ? "bg-success/15 text-success dark:text-success" : b.status === "cheque_pending" ? "bg-warning/15 text-warning dark:text-warning" : b.status === "cancelled" ? "bg-destructive/15 text-destructive dark:text-destructive" : "bg-muted text-muted-foreground"}`}>
                              {b.status.replace("_", " ")}
                            </span>
                          </div>
                          {rescheduled && (
                            <div className="text-[11px] text-warning dark:text-warning mt-0.5">
                              Rescheduled from {formatDateIN(b.rescheduled_from_date)} → {formatDateIN(b.event_date)}
                            </div>
                          )}
                          {b.venue && <div className="text-[11px] text-muted-foreground mt-0.5">{b.venue}</div>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div><div className="text-muted-foreground">Total</div><div className="font-semibold">{formatINR(Number(b.total_amount))}</div></div>
                        <div><div className="text-muted-foreground">Paid</div><div className="font-semibold text-success dark:text-success">{formatINR(Number(b.amount_paid))}</div></div>
                        <div><div className="text-muted-foreground">Due</div><div className="font-semibold text-destructive dark:text-destructive">{formatINR(Number(b.balance_due))}</div></div>
                      </div>
                      {b.status !== "cancelled" && (
                        <BookingAssignedTo
                          bookingId={b.id}
                          companyId={b.company_id}
                          assignedTo={(b as any).assigned_to ?? null}
                          onChanged={loadBookings}
                        />
                      )}
                      {b.status !== "cancelled" && (
                        <CoordinationProgress bookingId={b.id} />
                      )}
                      {b.status !== "cancelled" && b.status !== "completed" && (
                        <div className="flex flex-wrap gap-1.5">
                          <CoordinatorAssign
                            bookingId={b.id}
                            companyId={b.company_id}
                            leadName={lead.full_name}
                            leadPhone={lead.phone}
                            eventType={(lead as any).event_type ?? null}
                            eventDate={b.event_date}
                            startTime={b.start_time}
                            venue={b.venue}
                            onAssigned={loadBookings}
                          />
                        </div>
                      )}
                      {pending.length > 0 && (
                        <div className="border-t pt-2 space-y-1">
                          <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1"><IndianRupee className="h-3 w-3" /> Pending payments</div>
                          {pending.map((p) => (
                            <div key={p.id} className="flex items-center justify-between text-xs">
                              <span>
                                {p.type === "instalment" ? `Instalment ${p.instalment_number}/${p.total_instalments}` : p.type.replace("_", " ")}
                                {p.due_date && <span className="text-muted-foreground"> · due {formatDateIN(p.due_date)}</span>}
                              </span>
                              <span className="font-medium">{formatINR(Number(p.amount))}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <BookingTasksList bookingId={b.id} />
                      <RemindersList bookingId={b.id} phone={lead.phone} />
                      {b.status !== "cancelled" && (
                        <VendorAssignment
                          bookingId={b.id}
                          companyId={b.company_id}
                          eventDate={b.event_date}
                          startTime={b.start_time}
                          venue={b.venue}
                          clientName={lead.full_name}
                        />
                      )}
                      {b.status !== "cancelled" && showEventDayLogs && (
                        <EventDayLogs bookingId={b.id} companyId={b.company_id} leadId={lead.id} />
                      )}
                      {b.status !== "cancelled" && b.status !== "completed" && (
                        <div className="border-t pt-2 flex flex-wrap gap-1.5">
                          {b.status === "cheque_pending" && (
                            <Button size="sm" variant="outline" className="h-8" onClick={() => setChequeBooking(b)}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Cheque status
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-8" onClick={() => { setPayCredsBooking(b); setPayCredsOpen(true); }}>
                            <CreditCard className="h-3.5 w-3.5 mr-1" /> Pay details
                          </Button>
                          <Button size="sm" variant="outline" className="h-8" onClick={() => setConfirmationBookingId(b.id)}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {b.confirmation_sent_at ? "Resend confirmation" : "Send confirmation"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-8" onClick={() => setReschedBooking(b)}>
                            <CalendarClock className="h-3.5 w-3.5 mr-1" /> Reschedule
                          </Button>
                          <Button size="sm" className="h-8 bg-success hover:bg-success text-white" onClick={() => setCompleteBooking(b)}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark complete
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0" aria-label="More booking actions">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() => setCancelBooking(b)}
                                className="text-destructive dark:text-destructive focus:text-destructive"
                              >
                                <XCircle className="h-4 w-4 mr-2" /> Cancel booking
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                      {b.status === "completed" && (
                        <div className="border-t pt-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[11px] text-muted-foreground">
                            {b.completed_at && <>Completed {formatDateIN(b.completed_at)}</>}
                          </div>
                          <Button size="sm" variant="outline" className="h-8" onClick={() => { setEditReqId(null); setReqOpen(true); }}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Start new requirement
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
                    {f.is_sent && <div className="text-[11px] text-success dark:text-success mt-1">✓ Done</div>}
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
        companyId={lead.company_id}
        performedBy={profile?.id ?? null}
        onScheduleFollowUp={() => setFuOpen(true)}
        onScheduleMeeting={() => setMeetingOpen(true)}
        onInterested={() => {
          // No requirement yet → prompt to complete event details first
          const latest = requirements[requirements.length - 1];
          if (!latest) { setEditReqId(null); setReqOpen(true); toast.info("Complete event details first, then build the quotation."); return; }
          // Otherwise open the builder immediately, pre-filled from the latest requirement
          setQuoteReqId(latest.id); setEditQuoteId(null); setReviseQuoteId(null); setQuoteOpen(true);
        }}
        onChanged={() => { load(); }}
      />
      <MeetingSchedulerDialog
        open={meetingOpen}
        onOpenChange={setMeetingOpen}
        leadId={lead.id}
        leadName={lead.full_name}
        leadPhone={lead.phone}
        companyId={lead.company_id}
        onScheduled={() => load()}
      />
      <PaymentCredentialsDialog
        open={payCredsOpen}
        onOpenChange={setPayCredsOpen}
        leadId={lead.id}
        leadName={lead.full_name}
        leadPhone={lead.phone}
        companyId={lead.company_id}
        bookingId={payCredsBooking?.id ?? null}
        amount={payCredsBooking ? Number(payCredsBooking.balance_due || payCredsBooking.total_amount) : null}
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
        alreadyFlagged={lead.is_blacklisted}
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
      {decisionReqId && (
        <DecisionDialog
          open={!!decisionReqId}
          onOpenChange={(v) => { if (!v) setDecisionReqId(null); }}
          leadId={lead.id}
          companyId={lead.company_id}
          requirementId={decisionReqId}
          onDone={() => { loadRequirements(); load(); }}
        />
      )}
      <QuotationBuilder
        open={quoteOpen}
        onOpenChange={(v) => { setQuoteOpen(v); if (!v) { setReviseQuoteId(null); loadQuotations(); } }}
        leadId={lead.id}
        companyId={lead.company_id}
        requirementId={quoteReqId}
        quotationId={editQuoteId}
        reviseFromId={reviseQuoteId}
        onSaved={loadQuotations}
        onContinueToSend={(id) => { setQuoteOpen(false); setReviseQuoteId(null); loadQuotations(); setSendQuoteId(id); }}
      />
      <SendQuotationDialog
        open={!!sendQuoteId}
        onOpenChange={(v) => { if (!v) setSendQuoteId(null); }}
        quotationId={sendQuoteId}
        onResponded={() => { loadQuotations(); load(); }}
        onAgreed={() => { loadQuotations(); load(); }}
      />
      <BookingConfirmDialog
        open={!!bookQuoteId}
        onOpenChange={(v) => { if (!v) setBookQuoteId(null); }}
        quotationId={bookQuoteId}
        onConfirmed={(bookingId) => { loadBookings(); loadQuotations(); load(); setConfirmationBookingId(bookingId); }}
      />
      <PaymentReceivedDialog
        open={!!paymentReceivedQuoteId}
        onOpenChange={(v) => { if (!v) setPaymentReceivedQuoteId(null); }}
        quotationId={paymentReceivedQuoteId}
        defaultMethod={paymentReceivedMethod}
        onConfirmed={(bookingId) => { loadBookings(); loadQuotations(); load(); setConfirmationBookingId(bookingId); }}
      />
      <BookingConfirmationDialog
        open={!!confirmationBookingId}
        onOpenChange={(v) => { if (!v) setConfirmationBookingId(null); }}
        bookingId={confirmationBookingId}
        onSent={() => { loadBookings(); load(); }}
      />
      {chequeBooking && (
        <ChequeClearDialog open={!!chequeBooking} onOpenChange={(v) => { if (!v) setChequeBooking(null); }}
          booking={chequeBooking} onDone={() => { loadBookings(); load(); }} />
      )}
      {cancelBooking && (
        <CancelBookingDialog open={!!cancelBooking} onOpenChange={(v) => { if (!v) setCancelBooking(null); }}
          booking={cancelBooking} onDone={() => { loadBookings(); load(); }} />
      )}
      {reschedBooking && (
        <RescheduleBookingDialog open={!!reschedBooking} onOpenChange={(v) => { if (!v) setReschedBooking(null); }}
          booking={reschedBooking} onDone={() => { loadBookings(); load(); }} />
      )}
      {completeBooking && (
        <EventCompleteDialog open={!!completeBooking} onOpenChange={(v) => { if (!v) setCompleteBooking(null); }}
          booking={completeBooking} leadId={lead.id} leadPhone={lead.phone}
          onDone={() => { loadBookings(); load(); }} />
      )}
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
