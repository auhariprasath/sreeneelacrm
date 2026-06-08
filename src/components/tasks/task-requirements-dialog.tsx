import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Send } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { buildRequirementsMessage, loadTaskRequirementsContext, sendTaskRequirements, type TaskRequirementsContext } from "@/lib/task-requirements";
import { WhatsAppSendButton } from "@/components/whatsapp-send-button";


interface Props {
  taskId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSent?: () => void;
}

export function TaskRequirementsDialog({ taskId, open, onOpenChange, onSent }: Props) {
  const { profile } = useAuth();
  const [ctx, setCtx] = useState<TaskRequirementsContext | null>(null);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bookingId, setBookingId] = useState<string>("");
  const [leadId, setLeadId] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");

  useEffect(() => {
    if (!open || !taskId) return;
    setEditing(false);
    setBusy(false);
    setCtx(null);
    (async () => {
      const c = await loadTaskRequirementsContext(taskId);
      if (!c) { toast.error("Task has no assignee yet"); onOpenChange(false); return; }
      setCtx(c);
      setMessage(buildRequirementsMessage(c));
      // also need booking/lead/company ids — refetch task
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: t } = await supabase.from("tasks").select("booking_id, company_id").eq("id", taskId).maybeSingle();
      const { data: b } = t ? await supabase.from("bookings").select("lead_id").eq("id", t.booking_id).maybeSingle() : { data: null as any };
      setBookingId(t?.booking_id ?? "");
      setCompanyId(t?.company_id ?? "");
      setLeadId(b?.lead_id ?? "");
    })();
  }, [open, taskId, onOpenChange]);

  const send = async (channel: "in_app" | "whatsapp" = "in_app") => {
    if (!ctx || !taskId) return;
    if (channel === "whatsapp") {
      const link = buildTaskWaLink(ctx.assigneePhone, message);
      if (!link) { toast.error(`${ctx.assigneeName} has no phone number on file`); return; }
      window.open(link, "_blank", "noopener");
    }
    setBusy(true);
    const { error } = await sendTaskRequirements({
      taskId,
      ctx,
      message,
      bookingId,
      leadId,
      companyId,
      sentByUserId: profile?.id ?? null,
      channel,
    });
    setBusy(false);
    if (error) { toast.error(error); return; }
    toast.success(
      channel === "whatsapp"
        ? `WhatsApp opened for ${ctx.assigneeName} ✓`
        : `Requirements sent to ${ctx.assigneeName} ✓`,
    );
    onSent?.();
    onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Task requirements preview</DialogTitle>
          <DialogDescription>
            {ctx ? <>Review before sending to <span className="font-medium">{ctx.assigneeName}</span>.</> : "Loading…"}
          </DialogDescription>
        </DialogHeader>
        {ctx && (
          editing ? (
            <Textarea rows={16} value={message} onChange={(e) => setMessage(e.target.value)} className="font-mono text-xs" />
          ) : (
            <pre className="text-xs whitespace-pre-wrap bg-muted/40 border rounded-md p-3 max-h-[60vh] overflow-auto">{message}</pre>
          )
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setEditing((v) => !v)} disabled={!ctx || busy}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> {editing ? "Done editing" : "Edit message"}
          </Button>
          <Button variant="outline" onClick={() => send("whatsapp")} disabled={!ctx || busy} title={ctx?.assigneePhone ? "Open WhatsApp" : "No phone on file"}>
            <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
          </Button>
          <Button onClick={() => send("in_app")} disabled={!ctx || busy}>
            <Send className="h-3.5 w-3.5 mr-1" /> {busy ? "Sending…" : ctx ? `Send to ${ctx.assigneeName}` : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
