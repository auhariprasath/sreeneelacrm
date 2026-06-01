import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Phone, MessageSquare, Eye, EyeOff, Send } from "lucide-react";
import { toast } from "sonner";
import { formatPhoneIN, formatDateTimeIN, initialsOf, relativeTime } from "@/lib/format";
import { StatusBadge, ScoreBadge } from "@/components/leads/lead-badges";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Activity = Database["public"]["Tables"]["activity_logs"]["Row"];
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
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
    if (error || !data) { toast.error("Lead not found"); navigate({ to: "/leads" }); return; }
    setLead(data as Lead);
    // log view
    await supabase.from("activity_logs").insert({
      lead_id: leadId, action: "Viewed lead", action_type: "view", performed_by: profile?.id ?? null,
    });
    const { data: acts } = await supabase
      .from("activity_logs").select("*").eq("lead_id", leadId)
      .order("created_at", { ascending: false }).limit(50);
    setActivities((acts as Activity[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [leadId]);

  // realtime activities
  useEffect(() => {
    const ch = supabase.channel(`lead-${leadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs", filter: `lead_id=eq.${leadId}` },
        (p) => setActivities((prev) => [p.new as Activity, ...prev]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads", filter: `id=eq.${leadId}` },
        (p) => setLead(p.new as Lead))
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

  if (loading || !lead) {
    return <div className="text-sm text-muted-foreground">Loading lead…</div>;
  }

  const masked = (profile?.phone_masked ?? false) && !unmasked;
  const tel = (lead.phone || "").replace(/\D/g, "").slice(-10);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <Link to="/leads" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>

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
            </div>

            <div className="mt-4 flex gap-2 flex-wrap">
              <a href={`tel:+91${tel}`} className="inline-flex items-center gap-2 h-11 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium">
                <Phone className="h-4 w-4" /> Call
              </a>
              <a href={`https://wa.me/91${tel}`} target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-2 h-11 px-4 rounded-md bg-emerald-600 text-white text-sm font-medium">
                <MessageSquare className="h-4 w-4" /> WhatsApp
              </a>
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="notes">Add note</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3 pt-3">
          <InfoRow label="Language" value={lead.language} />
          <InfoRow label="Source" value={lead.source.replace("_"," ")} />
          <InfoRow label="Score" value={lead.lead_score} />
          <InfoRow label="Follow-up attempts" value={`${lead.follow_up_count} / ${lead.max_follow_up_attempts}`} />
          {lead.notes && (
            <div className="bg-card border rounded-md p-3">
              <div className="text-[11px] text-muted-foreground mb-1">Initial notes</div>
              <div className="text-sm whitespace-pre-wrap">{lead.notes}</div>
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

        <TabsContent value="notes" className="pt-3 space-y-2">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Type a note about this lead…" />
          <Button onClick={addNote} disabled={saving || !note.trim()} className="min-h-11">
            <Send className="h-4 w-4 mr-1.5" /> {saving ? "Saving…" : "Add note"}
          </Button>
        </TabsContent>
      </Tabs>
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
