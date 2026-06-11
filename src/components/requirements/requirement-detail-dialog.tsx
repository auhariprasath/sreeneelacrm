import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateIN, formatINR, formatTimeOfDay } from "@/lib/format";
import { Pencil, CalendarDays, Clock, Users, Sparkles, IndianRupee, Tag, FileText, ClipboardList, CheckCircle2, ThumbsDown, CalendarClock, FileCheck2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Requirement = Database["public"]["Tables"]["requirements"]["Row"];

interface AddOn { addon_name: string; addon_price: number; is_custom: boolean }

type DecisionType = "interested" | "not_interested" | "needs_time" | "confirm_booking";
interface DecisionRecord { decision: DecisionType; note: string | null; created_at: string }

const DECISION_LABELS: Record<DecisionType, { label: string; icon: React.ReactNode; cls: string }> = {
  interested:       { label: "Interested — proposal stage", icon: <FileCheck2 className="h-3.5 w-3.5" />, cls: "bg-success/10 text-success border-success/30" },
  confirm_booking:  { label: "Ready to confirm booking",   icon: <CheckCircle2 className="h-3.5 w-3.5" />, cls: "bg-primary/10 text-primary border-primary/30" },
  needs_time:       { label: "Needs more time",             icon: <CalendarClock className="h-3.5 w-3.5" />, cls: "bg-warning/10 text-warning border-warning/30" },
  not_interested:   { label: "Not interested — dropped",   icon: <ThumbsDown className="h-3.5 w-3.5" />, cls: "bg-destructive/10 text-destructive border-destructive/30" },
};

interface Props {
  requirement: Requirement | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit: () => void;
}

function Field({ label, value, icon }: { label: string; value?: string | number | null; icon?: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-2 py-2 border-b last:border-0">
      {icon && <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-sm font-medium mt-0.5">{value}</div>
      </div>
    </div>
  );
}

export function RequirementDetailDialog({ requirement: r, open, onOpenChange, onEdit }: Props) {
  const [addons, setAddons] = useState<AddOn[]>([]);
  const [decision, setDecision] = useState<DecisionRecord | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !r) return;
    setLoading(true);
    setDecision(null);
    Promise.all([
      supabase.from("add_ons_selected").select("addon_name, addon_price, is_custom").eq("requirement_id", r.id),
      supabase.from("activity_logs")
        .select("metadata, note, created_at")
        .eq("lead_id", r.lead_id)
        .eq("action_type", "status_change")
        .order("created_at", { ascending: false })
        .limit(50),
    ]).then(([addonsRes, logsRes]) => {
      setAddons((addonsRes.data as AddOn[]) ?? []);
      const logs = (logsRes.data as any[]) ?? [];
      const dec = logs.find((l) => (l.metadata as any)?.requirement_id === r.id && (l.metadata as any)?.decision);
      if (dec) {
        setDecision({ decision: (dec.metadata as any).decision, note: dec.note, created_at: dec.created_at });
      }
      setLoading(false);
    });
  }, [open, r?.id]);

  if (!r) return null;

  const eventTypeLabel = r.event_type === "other" || r.event_type === "Other"
    ? (r.event_type_other ?? "Other")
    : r.event_type;

  const catalogAddons = addons.filter((a) => !a.is_custom);
  const customAddons = addons.filter((a) => a.is_custom);
  const addonsTotal = addons.reduce((s, a) => s + Number(a.addon_price || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Requirement #{r.requirement_number}
            <Badge variant="outline" className="ml-auto text-[10px] uppercase tracking-wide">
              {r.status.replace(/_/g, " ")}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Decision banner */}
        {decision && (() => {
          const d = DECISION_LABELS[decision.decision];
          return (
            <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${d.cls}`}>
              {d.icon}
              <div className="min-w-0 flex-1">
                <div className="font-medium">{d.label}</div>
                {decision.note && <div className="text-xs mt-0.5 opacity-80">{decision.note}</div>}
                <div className="text-[11px] mt-0.5 opacity-60">{formatDateIN(decision.created_at)}</div>
              </div>
            </div>
          );
        })()}

        <div className="space-y-0 divide-y">
          <Field label="Event type" value={eventTypeLabel} icon={<Tag className="h-3.5 w-3.5" />} />
          <Field label="Event date" value={r.event_date ? formatDateIN(r.event_date) : null} icon={<CalendarDays className="h-3.5 w-3.5" />} />
          {(r.start_time || r.end_time) && (
            <div className="flex items-start gap-2 py-2 border-b">
              <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Time</div>
                <div className="text-sm font-medium mt-0.5">
                  {r.start_time ? formatTimeOfDay(r.start_time) : "—"}
                  {r.end_time && <> – {formatTimeOfDay(r.end_time)}</>}
                  {r.duration_hours && <span className="text-muted-foreground font-normal ml-1">({r.duration_hours}h)</span>}
                </div>
              </div>
            </div>
          )}
          <Field label="Muhurtham time" value={r.muhurtham_time ? formatTimeOfDay(r.muhurtham_time) : null} icon={<Clock className="h-3.5 w-3.5" />} />
          <Field label="Guest count" value={r.guest_count} icon={<Users className="h-3.5 w-3.5" />} />
          <Field label="Community" value={r.community} icon={<Tag className="h-3.5 w-3.5" />} />
          <Field label="Budget range" value={r.budget_range} icon={<IndianRupee className="h-3.5 w-3.5" />} />
          <Field label="Session" value={r.session_name} icon={<Clock className="h-3.5 w-3.5" />} />
          {r.notes && (
            <div className="flex items-start gap-2 py-2 border-b">
              <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Notes</div>
                <div className="text-sm mt-0.5 whitespace-pre-wrap">{r.notes}</div>
              </div>
            </div>
          )}
        </div>

        {/* Add-ons */}
        {!loading && addons.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Sparkles className="h-3.5 w-3.5" /> Add-ons
            </div>
            <div className="rounded-lg border divide-y">
              {catalogAddons.map((a, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{a.addon_name}</span>
                  <span className="text-muted-foreground">{formatINR(Number(a.addon_price), { short: true })}</span>
                </div>
              ))}
              {customAddons.map((a, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-muted-foreground" /> {a.addon_name}
                    <span className="text-[10px] text-muted-foreground">(custom)</span>
                  </span>
                  <span className="text-muted-foreground">{formatINR(Number(a.addon_price), { short: true })}</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-right text-muted-foreground">
              Add-ons total: <span className="font-semibold text-foreground">{formatINR(addonsTotal)}</span>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-xs text-muted-foreground text-center py-2">Loading add-ons…</div>
        )}

        {!loading && addons.length === 0 && (
          <div className="text-xs text-muted-foreground">No add-ons selected.</div>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={() => { onOpenChange(false); onEdit(); }} className="gap-2">
            <Pencil className="h-3.5 w-3.5" /> Edit requirement
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
