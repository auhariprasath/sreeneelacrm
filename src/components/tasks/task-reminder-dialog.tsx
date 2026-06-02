import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_REMINDER_FORM,
  cancelReminder,
  loadReminderForTask,
  reminderRowToForm,
  saveReminder,
  type ReminderFormState,
} from "@/lib/task-reminders";
import { TaskReminderSection } from "./task-reminder-section";

interface Props {
  taskId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

export function TaskReminderDialog({ taskId, open, onOpenChange, onSaved }: Props) {
  const { profile } = useAuth();
  const [form, setForm] = useState<ReminderFormState>(DEFAULT_REMINDER_FORM);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [taskDueAt, setTaskDueAt] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");
  const [eventDate, setEventDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !taskId) return;
    setBusy(false);
    setExistingId(null);
    setForm(DEFAULT_REMINDER_FORM);
    (async () => {
      const { data: task } = await supabase
        .from("tasks")
        .select("id, due_at, company_id, booking_id")
        .eq("id", taskId)
        .maybeSingle();
      if (!task) { toast.error("Task not found"); onOpenChange(false); return; }
      setTaskDueAt(task.due_at);
      setCompanyId(task.company_id);
      if (task.booking_id) {
        const { data: b } = await supabase
          .from("bookings").select("event_date").eq("id", task.booking_id).maybeSingle();
        setEventDate(b?.event_date ?? null);
      }
      const { reminder } = await loadReminderForTask(taskId);
      if (reminder) {
        setExistingId(reminder.id);
        setForm(reminderRowToForm(reminder));
      }
    })();
  }, [open, taskId, onOpenChange]);

  const save = async () => {
    if (!taskId || !companyId) return;
    setBusy(true);
    const { error } = await saveReminder({
      taskId,
      companyId,
      taskDueAtIso: taskDueAt,
      bookingEventDate: eventDate,
      createdBy: profile?.id ?? null,
      form,
      existingId,
    });
    setBusy(false);
    if (error) { toast.error(error); return; }
    toast.success("Reminder saved");
    onSaved?.();
    onOpenChange(false);
  };

  const remove = async () => {
    if (!existingId) return;
    setBusy(true);
    const { error } = await cancelReminder(existingId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Reminder removed");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existingId ? "Edit reminder" : "Set reminder"}</DialogTitle>
          <DialogDescription>Schedule a one-off or repeating reminder for this task.</DialogDescription>
        </DialogHeader>
        <TaskReminderSection value={form} onChange={setForm} hasBookingDate={!!eventDate} />
        <DialogFooter className="gap-2 sm:gap-2">
          {existingId && (
            <Button variant="outline" onClick={remove} disabled={busy} className="mr-auto">
              Remove
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : existingId ? "Update" : "Save reminder"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
