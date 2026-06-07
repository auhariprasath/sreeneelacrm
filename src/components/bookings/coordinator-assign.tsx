import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { UserCheck } from "lucide-react";
import { toast } from "sonner";
import { formatDateIN, formatTimeOfDay } from "@/lib/format";
import { buildWaMeLink } from "@/lib/utils";

type Staff = { id: string; full_name: string; phone: string | null };

interface Props {
  bookingId: string;
  companyId: string;
  leadName: string;
  leadPhone: string | null;
  eventType: string | null;
  eventDate: string;
  startTime: string | null;
  venue: string | null;
  onAssigned?: () => void;
}

export function CoordinatorAssign(props: Props) {
  const { bookingId, companyId, leadName, leadPhone, eventType, eventDate, startTime, venue } = props;
  const [companyName, setCompanyName] = useState<string>("");
  useEffect(() => {
    supabase.from("companies").select("name").eq("id", companyId).maybeSingle()
      .then(({ data }) => setCompanyName(((data as any)?.name) ?? ""));
  }, [companyId]);
  const [alreadyAssigned, setAlreadyAssigned] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.from("event_coordination" as any).select("id").eq("booking_id", bookingId).maybeSingle()
      .then(({ data }) => setAlreadyAssigned(!!data));
  }, [bookingId]);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [picked, setPicked] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || staff.length) return;
    supabase
      .from("profiles")
      .select("id, full_name, phone")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => setStaff((data as Staff[]) ?? []));
  }, [open, companyId, staff.length]);

  const chosen = staff.find((s) => s.id === picked) ?? null;

  const proceed = () => {
    if (!picked) { toast.error("Pick a coordinator first"); return; }
    setOpen(false);
    setConfirmOpen(true);
  };

  const doAssign = async () => {
    if (!chosen) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const insertRes = await supabase
      .from("event_coordination" as any)
      .insert({
        booking_id: bookingId,
        company_id: companyId,
        coordinator_id: chosen.id,
        assigned_by: u.user?.id ?? null,
      })
      .select("coordinator_token, client_status_token, id")
      .maybeSingle();
    if (insertRes.error || !insertRes.data) {
      setSaving(false);
      toast.error(insertRes.error?.message || "Failed to assign");
      return;
    }
    const row: any = insertRes.data;
    // Log first stage as completed (coordinator_assigned)
    await supabase.from("event_coordination_updates" as any).insert({
      coordination_id: row.id,
      booking_id: bookingId,
      company_id: companyId,
      stage: "coordinator_assigned",
      updated_by: u.user?.id ?? null,
      updated_via: "assignment",
    });
    setSaving(false);
    setConfirmOpen(false);
    setPicked("");
    toast.success("Coordinator assigned ✓");
    props.onAssigned?.();

    const origin = window.location.origin;
    const coordUrl = `${origin}/coordinate/${row.coordinator_token}`;
    const clientUrl = `${origin}/event-status/${row.client_status_token}`;

    // 1) WA to coordinator
    if (chosen.phone) {
      const msg =
        `Hi ${chosen.full_name}, you've been assigned to coordinate an event.\n\n` +
        `Client: ${leadName}\n` +
        `Event: ${eventType ?? "Event"} on ${formatDateIN(eventDate)}${startTime ? ` at ${formatTimeOfDay(startTime)}` : ""}\n` +
        (venue ? `Venue: ${venue}\n` : "") +
        `\nYour coordination link (update stages here):\n${coordUrl}\n\n— ${companyName}`;
      const url = buildWaMeLink(chosen.phone, msg);
      if (url) window.open(url, "_blank");
    } else {
      toast.message("Coordinator has no phone on file — copy link manually", { description: coordUrl });
    }

    // 2) WA to lead (small delay so popups don't collide)
    if (leadPhone) {
      setTimeout(() => {
        const msg =
          `Hi ${leadName}, your event coordinator has been assigned.\n\n` +
          `Track preparations live here:\n${clientUrl}\n\n— ${companyName}`;
        const url = buildWaMeLink(leadPhone, msg);
        if (url) window.open(url, "_blank");
      }, 600);
    }
  };

  if (alreadyAssigned) return null;
  return (
    <>
      <Button size="sm" variant="outline" className="h-8" onClick={() => setOpen(true)}>
        <UserCheck className="h-3.5 w-3.5 mr-1" /> Assign coordinator
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign coordinator</DialogTitle>
            <DialogDescription>Pick a team member to coordinate this event.</DialogDescription>
          </DialogHeader>
          <Select value={picked} onValueChange={setPicked}>
            <SelectTrigger><SelectValue placeholder="Select coordinator" /></SelectTrigger>
            <SelectContent>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={proceed}>Next</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={(o) => !saving && setConfirmOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign {chosen?.full_name} to this event?</DialogTitle>
            <DialogDescription>
              Event: {eventType ?? "Event"} on {formatDateIN(eventDate)}
              {startTime ? ` at ${formatTimeOfDay(startTime)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button disabled={saving} onClick={doAssign}>
              {saving ? "Assigning…" : "Yes, assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
