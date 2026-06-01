import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Plus, CheckCircle2, Loader2, Megaphone, FileEdit, CloudLightning, StickyNote, UserX } from "lucide-react";
import { toast } from "sonner";
import { formatDateTimeIN } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type Log = Database["public"]["Tables"]["event_day_logs"]["Row"];
type LogType = Database["public"]["Enums"]["event_day_log_type"];
type Severity = Database["public"]["Enums"]["event_day_severity"];
type Status = Database["public"]["Enums"]["event_day_status"];

const TYPE_META: Record<LogType, { label: string; icon: any; defaultSeverity: Severity }> = {
  amendment: { label: "Amendment", icon: FileEdit, defaultSeverity: "low" },
  complaint: { label: "Complaint", icon: Megaphone, defaultSeverity: "medium" },
  vendor_no_show: { label: "Vendor no-show", icon: UserX, defaultSeverity: "high" },
  force_majeure: { label: "Force majeure", icon: CloudLightning, defaultSeverity: "high" },
  note: { label: "Note", icon: StickyNote, defaultSeverity: "low" },
};

const SEVERITY_CLASS: Record<Severity, string> = {
  low: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  high: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
};

const STATUS_CLASS: Record<Status, string> = {
  open: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  in_progress: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  resolved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

export function EventDayLogs({
  bookingId, companyId, leadId,
}: { bookingId: string; companyId: string; leadId: string }) {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [resolveLog, setResolveLog] = useState<Log | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("event_day_logs")
      .select("*").eq("booking_id", bookingId)
      .order("created_at", { ascending: false });
    setLogs((data as Log[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [bookingId]);

  const openCount = logs.filter((l) => l.status === "open" || l.status === "in_progress").length;

  return (
    <div className="border-t pt-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Event day log
          {openCount > 0 && (
            <Badge variant="outline" className={`ml-1 h-4 px-1 text-[10px] ${SEVERITY_CLASS.high}`}>
              {openCount} open
            </Badge>
          )}
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="h-3 w-3 mr-1" /> Log
        </Button>
      </div>

      {loading ? (
        <div className="h-8 rounded bg-muted/40 animate-pulse" />
      ) : logs.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic">No incidents logged.</div>
      ) : (
        <div className="space-y-1.5">
          {logs.map((l) => {
            const meta = TYPE_META[l.log_type];
            const Icon = meta.icon;
            return (
              <div key={l.id} className="rounded-md border p-2 text-xs space-y-1 bg-background">
                <div className="flex items-start gap-2">
                  <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-semibold truncate">{l.title}</span>
                      {l.severity && (
                        <Badge variant="outline" className={`h-4 px-1 text-[10px] ${SEVERITY_CLASS[l.severity]}`}>
                          {l.severity}
                        </Badge>
                      )}
                      <Badge variant="outline" className={`h-4 px-1 text-[10px] ${STATUS_CLASS[l.status]}`}>
                        {l.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 whitespace-pre-wrap">{l.description}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{formatDateTimeIN(l.created_at)}</div>
                    {l.resolution_note && (
                      <div className="mt-1 rounded bg-emerald-500/10 border border-emerald-500/30 p-1.5 text-[11px]">
                        <span className="font-medium text-emerald-700 dark:text-emerald-300">Resolution: </span>
                        {l.resolution_note}
                      </div>
                    )}
                  </div>
                  {(l.status === "open" || l.status === "in_progress") && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setResolveLog(l)}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Resolve
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddLogDialog
        open={addOpen} onOpenChange={setAddOpen}
        bookingId={bookingId} companyId={companyId} leadId={leadId}
        userId={profile?.id ?? null}
        onDone={load}
      />
      <ResolveLogDialog
        log={resolveLog} onOpenChange={(v) => !v && setResolveLog(null)}
        userId={profile?.id ?? null} leadId={leadId} onDone={load}
      />
    </div>
  );
}

function AddLogDialog({
  open, onOpenChange, bookingId, companyId, leadId, userId, onDone,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  bookingId: string; companyId: string; leadId: string;
  userId: string | null; onDone: () => void;
}) {
  const [logType, setLogType] = useState<LogType>("amendment");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("low");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setLogType("amendment"); setTitle(""); setDescription(""); setSeverity("low");
    }
  }, [open]);

  useEffect(() => {
    setSeverity(TYPE_META[logType].defaultSeverity);
  }, [logType]);

  const submit = async () => {
    if (!title.trim() || !description.trim()) { toast.error("Title and description required"); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("event_day_logs").insert({
        booking_id: bookingId, company_id: companyId,
        log_type: logType, title: title.trim(), description: description.trim(),
        severity, status: "open", logged_by: userId,
      });
      if (error) throw error;
      await supabase.from("activity_logs").insert({
        lead_id: leadId, action: `Event-day: ${TYPE_META[logType].label}`,
        action_type: "system", note: title, performed_by: userId,
      });
      toast.success("Incident logged");
      onDone(); onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Log event-day incident</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={logType} onValueChange={(v) => setLogType(v as LogType)}>
              <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_META) as LogType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_META[t].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
              <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary" className="min-h-11" />
          </div>
          <div>
            <Label className="text-xs">Description *</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="What happened?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="min-h-11">
            {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Log incident
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResolveLogDialog({
  log, onOpenChange, userId, leadId, onDone,
}: {
  log: Log | null; onOpenChange: (v: boolean) => void;
  userId: string | null; leadId: string; onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (log) setNote(""); }, [log]);

  if (!log) return null;

  const submit = async () => {
    if (!note.trim()) { toast.error("Resolution note required"); return; }
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("event_day_logs").update({
        status: "resolved", resolution_note: note.trim(),
        resolved_at: now, resolved_by: userId,
      }).eq("id", log.id);
      if (error) throw error;
      await supabase.from("activity_logs").insert({
        lead_id: leadId, action: `Resolved: ${log.title}`,
        action_type: "system", note: note, performed_by: userId,
      });
      toast.success("Incident resolved");
      onDone(); onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={!!log} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Resolve incident</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-md border p-2 bg-muted/30">
            <div className="font-medium">{log.title}</div>
            <div className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">{log.description}</div>
          </div>
          <div>
            <Label className="text-xs">Resolution note *</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="How was it resolved?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="min-h-11">
            {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Mark resolved
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
