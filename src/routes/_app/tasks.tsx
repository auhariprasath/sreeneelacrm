import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDashboardRealtime } from "@/hooks/use-dashboard-realtime";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoTip } from "@/components/ui/info-tip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Phone, MessageCircle, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { formatDateTimeIN } from "@/lib/format";
import { AddTaskDialog } from "@/components/tasks/add-task-dialog";
import { TaskReminderDialog } from "@/components/tasks/task-reminder-dialog";
import { buildWaMeLink, openWaMeLink } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_app/tasks")({ component: TasksPage });

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type Bucket = "pending" | "in_progress" | "done" | "overdue";

type EnrichedTask = TaskRow & {
  lead_id: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  event_date: string | null;
  event_type: string | null;
  assignee_name: string | null;
  coordinator_id: string | null;
  coordinator_name: string | null;
  coordinator_phone: string | null;
  has_reminder: boolean;
};

const STATUS_META: Record<Bucket, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-muted text-foreground" },
  in_progress: { label: "In progress", cls: "bg-blue-100 text-info dark:bg-info/20 dark:text-info" },
  done: { label: "Completed", cls: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" },
  overdue: { label: "Overdue", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
};

const PRIORITY_CLS: Record<string, string> = {
  high: "bg-red-500", medium: "bg-warning", low: "bg-muted-foreground",
};

function applyOverdue<T extends { status: TaskRow["status"]; due_at: string }>(t: T): T {
  if (t.status === "done") return t;
  if (new Date(t.due_at).getTime() < Date.now() && t.status !== "overdue") {
    return { ...t, status: "overdue" };
  }
  return t;
}

/* ── Contact popup state ── */
type ContactPopup = {
  open: boolean;
  mode: "dial" | "whatsapp";
  clientName: string;
  clientPhone: string;
  coordName: string;
  coordPhone: string;
};
const CLOSED_POPUP: ContactPopup = {
  open: false, mode: "dial",
  clientName: "", clientPhone: "",
  coordName: "", coordPhone: "",
};

function TasksPage() {
  const { profile, role, companies, activeCompanyId } = useAuth();
  const [tab, setTab] = useState<"all" | "mine" | "overdue" | "done">("all");
  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [items, setItems] = useState<EnrichedTask[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [reminderTaskId, setReminderTaskId] = useState<string | null>(null);
  const [popup, setPopup] = useState<ContactPopup>(CLOSED_POPUP);

  const effectiveCompanyId = role === "super_admin"
    ? (companyFilter || activeCompanyId || null)
    : (profile?.company_id ?? activeCompanyId ?? companies[0]?.id ?? null);

  const load = async () => {
    setItems(null);
    let q = supabase.from("tasks").select("*").is("deleted_at", null).order("due_at", { ascending: true });
    if (effectiveCompanyId) q = q.eq("company_id", effectiveCompanyId);
    const { data, error } = await q;
    if (error) { toast.error(error.message); setItems([]); return; }
    const tasks = (data as TaskRow[]) ?? [];
    if (tasks.length === 0) { setItems([]); return; }

    const bookingIds = Array.from(new Set(tasks.map((t) => t.booking_id)));
    const assigneeIds = Array.from(new Set(tasks.map((t) => t.assigned_to).filter(Boolean) as string[]));

    const [bRes, coordRes] = await Promise.all([
      supabase.from("bookings").select("id, lead_id, event_date").in("id", bookingIds),
      supabase.from("event_coordination").select("booking_id, coordinator_id").in("booking_id", bookingIds),
    ]);

    const bookings = (bRes.data ?? []) as { id: string; lead_id: string; event_date: string }[];
    const coordRows = (coordRes.data ?? []) as { booking_id: string; coordinator_id: string }[];
    const coordMap = new Map(coordRows.map((c) => [c.booking_id, c.coordinator_id]));

    const leadIds = Array.from(new Set(bookings.map((b) => b.lead_id)));
    const coordinatorIds = Array.from(new Set(coordRows.map((c) => c.coordinator_id)));
    const allProfileIds = Array.from(new Set([...assigneeIds, ...coordinatorIds]));

    const [lRes, pRes, taskIds_resp, reqRes] = await Promise.all([
      leadIds.length
        ? supabase.from("leads").select("id, full_name, phone").in("id", leadIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string; phone: string | null }[] }),
      allProfileIds.length
        ? supabase.from("profiles").select("id, full_name, phone").in("id", allProfileIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string; phone: string | null }[] }),
      Promise.resolve(tasks.map((t) => t.id)),
      leadIds.length
        ? supabase.from("requirements").select("lead_id, event_type").in("lead_id", leadIds).is("deleted_at", null).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as { lead_id: string; event_type: string | null }[] }),
    ]);

    const bMap = new Map(bookings.map((b) => [b.id, b]));
    const lMap = new Map((lRes.data ?? []).map((l: any) => [l.id, l]));
    const pMap = new Map(((pRes.data ?? []) as any[]).map((p) => [p.id, p]));

    const reqMap: Record<string, string | null> = {};
    for (const r of ((reqRes as any).data ?? []) as any[]) {
      if (!reqMap[r.lead_id]) reqMap[r.lead_id] = r.event_type;
    }

    const { data: reminders } = taskIds_resp.length
      ? await supabase.from("task_reminders").select("task_id").eq("is_active", true).in("task_id", taskIds_resp)
      : { data: [] as { task_id: string }[] };
    const reminderSet = new Set(((reminders ?? []) as { task_id: string }[]).map((r) => r.task_id));

    setItems(tasks.map((t) => {
      const b = bMap.get(t.booking_id);
      const lead = b ? (lMap.get(b.lead_id) as any) : null;
      const coordId = coordMap.get(t.booking_id) ?? null;
      const coord = coordId ? (pMap.get(coordId) as any) : null;
      const assignee = t.assigned_to ? (pMap.get(t.assigned_to) as any) : null;
      return applyOverdue({
        ...t,
        lead_id: b?.lead_id ?? null,
        lead_name: lead?.full_name ?? null,
        lead_phone: lead?.phone ?? null,
        event_date: b?.event_date ?? null,
        event_type: b ? (reqMap[b.lead_id] ?? null) : null,
        assignee_name: assignee?.full_name ?? null,
        coordinator_id: coordId,
        coordinator_name: coord?.full_name ?? null,
        coordinator_phone: coord?.phone ?? null,
        has_reminder: reminderSet.has(t.id),
      });
    }));
  };

  useEffect(() => {
    if (role === "super_admin") setCompanyFilter(activeCompanyId ?? "");
  }, [role, activeCompanyId]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [effectiveCompanyId, role]);
  useDashboardRealtime(["tasks", "bookings", "leads"], load);

  const filtered = useMemo(() => {
    if (!items) return null;
    return items.filter((t) => {
      if (tab === "mine") return t.assigned_to === profile?.id;
      if (tab === "overdue") return t.status === "overdue";
      if (tab === "done") return t.status === "done";
      return true;
    });
  }, [items, tab, profile?.id]);

  const setStatus = async (id: string, status: Bucket) => {
    setItems((arr) => arr?.map((t) => t.id === id ? { ...t, status } : t) ?? null);
    const patch: any = { status };
    if (status === "done") { patch.completed_at = new Date().toISOString(); patch.completed_by = profile?.id ?? null; }
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) { toast.error(error.message); load(); return; }
    if (status === "done") toast.success("Task marked completed");
  };

  const openContactPopup = (task: EnrichedTask, mode: "dial" | "whatsapp") => {
    setPopup({
      open: true,
      mode,
      clientName: task.lead_name ?? "Client",
      clientPhone: task.lead_phone ?? "",
      coordName: task.coordinator_name ?? "Coordinator",
      coordPhone: task.coordinator_phone ?? "",
    });
  };

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Task board</h1>
          <p className="text-xs text-muted-foreground">Tasks auto-generated from booking templates</p>
        </div>
        <div className="flex items-center gap-2">
          {role === "super_admin" && !activeCompanyId && companies.length > 1 && (
            <select
              className="h-10 w-full sm:w-56 rounded-md border border-input bg-background px-3 text-sm"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            >
              <option value="">All companies</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {effectiveCompanyId && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add task
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="mine">My tasks</TabsTrigger>
          <TabsTrigger value="overdue">Overdue<InfoTip tip="overdueFollowUp" className="ml-1" /></TabsTrigger>
          <TabsTrigger value="done">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      {items === null && (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      )}

      {filtered && filtered.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">No tasks here yet.</Card>
      )}

      {filtered && filtered.length > 0 && (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Client name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Event type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Event date &amp; time</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Assigned to</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Task status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const meta = STATUS_META[t.status as Bucket] ?? STATUS_META.pending;
                const hasContact = t.lead_phone || t.coordinator_phone;
                return (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_CLS[t.priority] ?? PRIORITY_CLS.medium}`} />
                        <span className="font-medium">{t.lead_name ?? "—"}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 pl-3.5">{t.title}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{t.event_type ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {t.event_date ? formatDateTimeIN(`${t.event_date}T00:00:00`) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-xs text-muted-foreground">Due: {formatDateTimeIN(t.due_at)}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {t.assignee_name ? (
                        <div>
                          <div className="text-sm">{t.assignee_name}</div>
                          {t.coordinator_name && t.coordinator_name !== t.assignee_name && (
                            <div className="text-xs text-muted-foreground">Coord: {t.coordinator_name}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={`text-xs ${meta.cls}`}>{meta.label}</Badge>
                        <button
                          type="button"
                          onClick={() => setReminderTaskId(t.id)}
                          title={t.has_reminder ? "Edit reminder" : "Set reminder"}
                          className={`inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted ${t.has_reminder ? "text-primary" : "text-muted-foreground"}`}
                        >
                          {t.has_reminder ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      {t.status !== "done" && (
                        <select
                          className="mt-1 text-xs rounded border border-input bg-background px-1 py-0.5 w-full max-w-[120px]"
                          value={t.status}
                          onChange={(e) => setStatus(t.id, e.target.value as Bucket)}
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In progress</option>
                          <option value="done">Completed</option>
                        </select>
                      )}
                      {t.status === "done" && (
                        <button
                          type="button"
                          className="mt-1 text-xs text-muted-foreground hover:text-foreground underline"
                          onClick={() => setStatus(t.id, "pending")}
                        >
                          Reopen
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          title="Dial"
                          disabled={!hasContact}
                          onClick={() => openContactPopup(t, "dial")}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md border hover:bg-accent transition-colors disabled:opacity-40"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="WhatsApp"
                          disabled={!hasContact}
                          onClick={() => openContactPopup(t, "whatsapp")}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md border hover:bg-accent transition-colors disabled:opacity-40"
                        >
                          <MessageCircle className="h-3.5 w-3.5 text-success" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Contact popup */}
      <Dialog open={popup.open} onOpenChange={(v) => { if (!v) setPopup(CLOSED_POPUP); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{popup.mode === "dial" ? "Call" : "WhatsApp"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {popup.clientPhone ? (
              <ContactOption
                mode={popup.mode}
                label={`Client — ${popup.clientName}`}
                phone={popup.clientPhone}
                onClose={() => setPopup(CLOSED_POPUP)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No client phone on record.</p>
            )}
            {popup.coordPhone ? (
              <ContactOption
                mode={popup.mode}
                label={`Coordinator — ${popup.coordName}`}
                phone={popup.coordPhone}
                onClose={() => setPopup(CLOSED_POPUP)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No coordinator phone on record.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {effectiveCompanyId && (
        <AddTaskDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          companyId={effectiveCompanyId}
          onCreated={load}
        />
      )}
      <TaskReminderDialog
        taskId={reminderTaskId}
        open={!!reminderTaskId}
        onOpenChange={(v) => { if (!v) setReminderTaskId(null); }}
        onSaved={load}
      />
    </div>
  );
}

function ContactOption({
  mode,
  label,
  phone,
  onClose,
}: {
  mode: "dial" | "whatsapp";
  label: string;
  phone: string;
  onClose: () => void;
}) {
  const handleClick = () => {
    if (mode === "dial") {
      window.open(`tel:${phone}`, "_self");
    } else {
      const url = buildWaMeLink(phone);
      if (url) openWaMeLink(url);
    }
    onClose();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-3 w-full rounded-lg border px-4 py-3 hover:bg-accent transition-colors text-left"
    >
      <span className={`flex items-center justify-center h-9 w-9 rounded-full ${mode === "dial" ? "bg-primary/10 text-primary" : "bg-success/10 text-success"}`}>
        {mode === "dial" ? <Phone className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
      </span>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{phone}</div>
      </div>
    </button>
  );
}
