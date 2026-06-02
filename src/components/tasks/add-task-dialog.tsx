import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskRequirementsDialog } from "./task-requirements-dialog";

interface Staff { id: string; full_name: string }
interface BookingOpt { id: string; event_date: string; lead_name: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  bookingId?: string;
  defaultDueAt?: string;
  onCreated?: () => void;
}

export function AddTaskDialog({ open, onOpenChange, companyId, bookingId, defaultDueAt, onCreated }: Props) {
  const { profile } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [bookings, setBookings] = useState<BookingOpt[]>([]);
  const [pickedBookingId, setPickedBookingId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const initialDate = defaultDueAt ? new Date(defaultDueAt) : new Date(Date.now() + 24 * 3600_000);
  const [dueDate, setDueDate] = useState<string>(initialDate.toISOString().slice(0, 10));
  const [dueTime, setDueTime] = useState<string>(initialDate.toTimeString().slice(0, 5));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(""); setDescription(""); setAssignedTo(""); setPriority("medium");
    setPickedBookingId(bookingId ?? "");
    const d = defaultDueAt ? new Date(defaultDueAt) : new Date(Date.now() + 24 * 3600_000);
    setDueDate(d.toISOString().slice(0, 10));
    setDueTime(d.toTimeString().slice(0, 5));
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => setStaff((data as Staff[]) ?? []));

    if (!bookingId) {
      (async () => {
        const { data: bks } = await supabase
          .from("bookings")
          .select("id, event_date, lead_id")
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .in("status", ["confirmed", "cheque_pending"])
          .order("event_date", { ascending: true })
          .limit(100);
        const ids = Array.from(new Set(((bks as { lead_id: string }[]) ?? []).map((b) => b.lead_id)));
        const { data: leads } = ids.length
          ? await supabase.from("leads").select("id, full_name").in("id", ids)
          : { data: [] as { id: string; full_name: string }[] };
        const lm = new Map((leads ?? []).map((l: { id: string; full_name: string }) => [l.id, l.full_name]));
        setBookings(((bks as { id: string; event_date: string; lead_id: string }[]) ?? []).map((b) => ({
          id: b.id,
          event_date: b.event_date,
          lead_name: lm.get(b.lead_id) ?? "—",
        })));
      })();
    }
  }, [open, companyId, defaultDueAt, bookingId]);

  const submit = async () => {
    const finalBookingId = bookingId ?? pickedBookingId;
    if (!finalBookingId) { toast.error("Pick a booking"); return; }
    if (!title.trim()) { toast.error("Task name is required"); return; }
    setBusy(true);
    const dueAt = new Date(`${dueDate}T${dueTime}:00`).toISOString();
    const { error } = await supabase.from("tasks").insert({
      booking_id: finalBookingId,
      company_id: companyId,
      title: title.trim(),
      description: description.trim() || null,
      assigned_to: assignedTo || null,
      priority,
      due_at: dueAt,
      is_from_template: false,
      created_by: profile?.id ?? null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Task added");
    onCreated?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add task</DialogTitle>
          <DialogDescription>Create a custom task for a booking.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {!bookingId && (
            <div>
              <Label>Booking *</Label>
              <Select value={pickedBookingId} onValueChange={setPickedBookingId}>
                <SelectTrigger><SelectValue placeholder="Pick a booking" /></SelectTrigger>
                <SelectContent>
                  {bookings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.lead_name} · {b.event_date}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Task name *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Confirm decoration count" />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>Due time</Label>
              <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Assign to</Label>
              <Select value={assignedTo || "unassigned"} onValueChange={(v) => setAssignedTo(v === "unassigned" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as "low" | "medium" | "high")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Adding…" : "Add task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

