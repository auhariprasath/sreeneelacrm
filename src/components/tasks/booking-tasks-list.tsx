import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, ListChecks, Send } from "lucide-react";
import { TaskRequirementsDialog } from "./task-requirements-dialog";

interface Task {
  id: string;
  title: string;
  status: string;
  due_at: string;
  assigned_to: string | null;
  assignee_name: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
}

export function BookingTasksList({ bookingId }: { bookingId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [resendTaskId, setResendTaskId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, status, due_at, assigned_to, vendor_id")
      .eq("booking_id", bookingId)
      .is("deleted_at", null)
      .order("due_at", { ascending: true });
    const list = (data as any[]) ?? [];
    const staffIds = Array.from(new Set(list.map((t) => t.assigned_to).filter(Boolean)));
    const vendorIds = Array.from(new Set(list.map((t) => t.vendor_id).filter(Boolean)));
    const staffMap = new Map<string, string>();
    const vendorMap = new Map<string, string>();
    if (staffIds.length) {
      const { data: ps } = await supabase.from("profiles").select("id, full_name").in("id", staffIds);
      (ps ?? []).forEach((p: any) => staffMap.set(p.id, p.full_name));
    }
    if (vendorIds.length) {
      const { data: vs } = await supabase.from("vendors").select("id, name").in("id", vendorIds);
      (vs ?? []).forEach((v: any) => vendorMap.set(v.id, v.name));
    }
    setTasks(list.map((t) => ({
      ...t,
      assignee_name: t.assigned_to ? staffMap.get(t.assigned_to) ?? "—" : null,
      vendor_name: t.vendor_id ? vendorMap.get(t.vendor_id) ?? null : null,
    })));
  };

  useEffect(() => { load(); }, [bookingId]);

  if (tasks.length === 0) return null;

  return (
    <div className="border-t pt-2 space-y-1">
      <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
        <ListChecks className="h-3 w-3" /> Tasks <span className="text-[10px] font-normal italic">· internal staff</span>
      </div>
      {tasks.map((t) => (
        <div key={t.id} className="flex items-center justify-between text-xs gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate">{t.title}</div>
            <div className="text-[10px] text-muted-foreground">
              {t.assignee_name ?? "Unassigned"} · {t.status.replace("_", " ")}
              {t.vendor_name && <span className="ml-1">· vendor: {t.vendor_name}</span>}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Task actions">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setResendTaskId(t.id)} disabled={!t.assigned_to}>
                <Send className="h-3.5 w-3.5 mr-2" /> Resend requirements
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
      <TaskRequirementsDialog
        taskId={resendTaskId}
        open={!!resendTaskId}
        onOpenChange={(v) => { if (!v) setResendTaskId(null); }}
      />
    </div>
  );
}
