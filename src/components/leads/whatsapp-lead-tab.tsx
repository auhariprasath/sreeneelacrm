import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, Send, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildWaMeLink, openWaMeLink } from "@/lib/utils";
import {
  WA_TEMPLATES, CATEGORY_LABELS,
  type WaTemplateCategory, type WaTemplatesMap,
} from "@/lib/wa-templates";
import { formatDateTimeIN } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Quotation = Database["public"]["Tables"]["quotations"]["Row"];
type Activity = Database["public"]["Tables"]["activity_logs"]["Row"];

type LeadStatus = "new" | "in_progress" | "follow_up" | "venue_meeting" | "positive" | "negative" | "neutral" | "closed" | "unresponsive" | "locked";

const NEXT_STATUS: Partial<Record<LeadStatus, LeadStatus>> = {
  new:           "in_progress",
  in_progress:   "follow_up",
  follow_up:     "venue_meeting",
  venue_meeting: "positive",
  negative:      "follow_up",
  unresponsive:  "follow_up",
  neutral:       "in_progress",
};

const CATEGORY_ORDER: WaTemplateCategory[] = [
  "lead_capture", "follow_up", "quotation", "booking_payment",
  "event_reminders", "post_event", "meetings", "tasks_coordination",
];

function suggestTemplateKey(lead: Lead, quotations: Quotation[]): string {
  const sentQs = quotations.filter(q => q.status !== "draft");
  const agreedQ = sentQs.find(q => q.status === "agreed");
  const declinedQ = sentQs.find(q => q.status === "declined");
  const sentQ = sentQs.find(q => q.status === "sent");
  const daysSince = (Date.now() - new Date(lead.created_at).getTime()) / 86400000;

  switch (lead.status) {
    case "new":
      // current: lead_ack → next phase: follow up
      return "day1_followup";
    case "in_progress":
      // current: follow up → next phase: venue meeting
      return "meeting_confirmed";
    case "follow_up":
      // current: follow up (deeper) → next phase: venue meeting
      return "meeting_confirmed";
    case "venue_meeting":
      // current: meeting → next phase: quotation
      return "quotation_sent";
    case "positive":
      // current: quotation sent → next phase: booking
      if (declinedQ) return "quotation_revised";
      if (sentQ) return "quotation_followup";
      return "booking_confirmed";
    case "negative":
      // current: declined → next phase: re-engage with revised quote
      return "quotation_revised";
    case "closed":
      // current: booked → next phase: post event
      return "feedback_request";
    case "unresponsive":
      // current: no answer → next phase: follow up
      return "day3_followup";
    case "neutral":
      // current: neutral → next phase: follow up with portfolio
      return "day5_portfolio";
    case "locked":
      // current: balance pending → next phase: remind and close
      return "balance_reminder";
    default:
      return "day1_followup";
  }
}

function renderWithLead(body: string, lead: Lead, companyName: string): string {
  const eventDate = lead.event_date
    ? new Date(lead.event_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "[Event date]";
  return body
    .replace(/\[Name\]/g, lead.full_name)
    .replace(/\[Company\]/g, companyName)
    .replace(/\[Event type\]/g, lead.event_type ?? "[Event type]")
    .replace(/\[Event date\]/g, eventDate);
}

interface Props {
  lead: Lead;
  quotations: Quotation[];
  activities: Activity[];
  companyId: string;
  onActivityLogged?: () => void;
  onStatusAdvanced?: (newStatus: LeadStatus) => void;
}

export function WhatsAppLeadTab({ lead, quotations, activities, companyId, onActivityLogged, onStatusAdvanced }: Props) {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState<WaTemplatesMap>({});
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ key: string; name: string } | null>(null);
  const [editedMsg, setEditedMsg] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("companies")
      .select("name, wa_templates")
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data }) => {
        const c = data as any;
        setCompanyName(c?.name ?? "");
        const stored = ((c?.wa_templates ?? {}) as WaTemplatesMap);
        const next: WaTemplatesMap = {};
        WA_TEMPLATES.forEach((t) => {
          next[t.key] = { body: stored[t.key]?.body ?? t.defaultBody, autoSend: stored[t.key]?.autoSend ?? false };
        });
        setTemplates(next);
        setLoading(false);
      });
  }, [companyId]);

  const suggestedKey = suggestTemplateKey(lead, quotations);
  const nextSuggested = WA_TEMPLATES.find((t) => t.key === suggestedKey);

  // Most recent WA message sent via this tab (logged with action containing "WhatsApp sent")
  const lastWaSent = activities.find(
    (a) => typeof a.action === "string" && a.action.startsWith("WhatsApp sent —"),
  );

  const openSend = (key: string, name: string) => {
    const body = templates[key]?.body ?? "";
    const rendered = renderWithLead(body, lead, companyName);
    setSelected({ key, name });
    setEditedMsg(rendered);
  };

  const sendDirect = async (key: string, name: string) => {
    const body = templates[key]?.body ?? "";
    const rendered = renderWithLead(body, lead, companyName);
    const url = buildWaMeLink(lead.phone, rendered);
    if (url) openWaMeLink(url);
    await supabase.from("activity_logs").insert({
      lead_id: lead.id,
      action: `WhatsApp sent — "${name}"`,
      note: rendered.slice(0, 300),
      action_type: "system",
      performed_by: profile?.id ?? null,
      metadata: { template_key: key } as any,
    });
    toast.success("WhatsApp opened ✓");
    onActivityLogged?.();
  };

  const handleSend = async () => {
    if (!selected || !editedMsg.trim()) return;
    setSending(true);
    const url = buildWaMeLink(lead.phone, editedMsg);
    if (url) openWaMeLink(url);
    await supabase.from("activity_logs").insert({
      lead_id: lead.id,
      action: `WhatsApp sent — "${selected.name}"`,
      note: editedMsg.slice(0, 300),
      action_type: "system",
      performed_by: profile?.id ?? null,
      metadata: { template_key: selected.key } as any,
    });

    // Advance lead status if this was the suggested template
    if (selected.key === suggestedKey) {
      const nextStatus = NEXT_STATUS[lead.status as LeadStatus];
      if (nextStatus) {
        await supabase.from("leads").update({ status: nextStatus }).eq("id", lead.id);
        onStatusAdvanced?.(nextStatus);
      }
    }

    toast.success("WhatsApp opened ✓");
    setSending(false);
    setSelected(null);
    onActivityLogged?.();
  };

  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const grouped = new Map<WaTemplateCategory, typeof WA_TEMPLATES>();
  WA_TEMPLATES.forEach((t) => {
    const arr = grouped.get(t.category as WaTemplateCategory) ?? [];
    arr.push(t);
    grouped.set(t.category as WaTemplateCategory, arr);
  });

  return (
    <div className="space-y-4 pt-3">
      {/* Status summary */}
      <div className="rounded-lg border bg-card p-3 space-y-2">
        {lastWaSent ? (
          <div className="text-xs">
            <span className="text-muted-foreground">Last sent: </span>
            <span className="font-medium">{lastWaSent.action}</span>
            <span className="text-muted-foreground"> · {formatDateTimeIN(lastWaSent.created_at)}</span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No WhatsApp messages sent via templates yet.</div>
        )}
        {nextSuggested && (
          <div className="flex items-center justify-between gap-2 pt-1 border-t">
            <div className="flex items-center gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-primary">Suggested next:</span>
              <span>{nextSuggested.name}</span>
            </div>
            <Button
              size="sm"
              className="h-7 text-xs bg-success hover:bg-success text-white"
              onClick={() => openSend(nextSuggested.key, nextSuggested.name)}
            >
              <Send className="h-3 w-3 mr-1" /> Send
            </Button>
          </div>
        )}
      </div>

      {/* All templates grouped by category */}
      {CATEGORY_ORDER.map((cat) => {
        const items = grouped.get(cat);
        if (!items) return null;
        return (
          <div key={cat}>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              {CATEGORY_LABELS[cat]}
            </div>
            <div className="space-y-1">
              {items.map((t) => (
                <div
                  key={t.key}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 ${t.key === suggestedKey ? "border-primary/40 bg-primary/5" : "bg-card"}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      {t.name}
                      {t.key === suggestedKey && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 border-primary/40 text-primary">
                          Suggested
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{t.fires}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs shrink-0"
                    onClick={() => openSend(t.key, t.name)}
                  >
                    <MessageSquare className="h-3 w-3 mr-1" /> Use
                  </Button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Send dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> {selected?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Edit message before sending to <span className="font-medium">{lead.full_name}</span>
            </div>
            <Textarea rows={8} value={editedMsg} onChange={(e) => setEditedMsg(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-success hover:bg-success text-white"
                onClick={handleSend}
                disabled={sending || !editedMsg.trim()}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <><Send className="h-4 w-4 mr-1.5" /> Open WhatsApp</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
