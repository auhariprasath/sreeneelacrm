import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoTip } from "@/components/ui/info-tip";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertTriangle, Circle, User as UserIcon, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatDateTimeIN } from "@/lib/format";
import { AddTaskDialog } from "@/components/tasks/add-task-dialog";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_app/tasks")({ component: TasksPage });

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type EnrichedTask = TaskRow & {
  lead_name: string | null;
  lead_id: string | null;
  event_date: string | null;
  assignee_name: string | null;
};

type Bucket = "pending" | "in_progress" | "done" | "overdue";

const STATUS_META: Record<Bucket, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-muted text-foreground" },
  in_progress: { label: "In progress", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" },
  done: { label: "Done", cls: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" },
  overdue: { label: "Overdue", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
};

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500", medium: "bg-amber-500", low: "bg-muted-foreground",
};

function applyOverdue<T extends { status: TaskRow["status"]; due_at: string }>(t: T): T {
  if (t.status === "done") return t;
  if (new Date(t.due_at).getTime() < Date.now() && t.status !== "overdue") {
    return { ...t, status: "overdue" };
  }
  return t;
}

function TasksPage() {
  const { profile, role, companies, activeCompanyId } = useAuth();
  const [tab, setTab] = useState<"all" | "mine" | "overdue" | "done">("all");
  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [items, setItems] = useState<EnrichedTask[] | null>(null);

  const load = async () => {
    setItems(null);
    let q = supabase.from("tasks").select("*").is("deleted_at", null).order("due_at", { ascending: true });
    if (role !== "super_admin" && activeCompanyId) q = q.eq("company_id", activeCompanyId);
    else if (companyFilter) q = q.eq("company_id", companyFilter);
    const { data, error } = await q;
    if (error) { toast.error(error.message); setItems([]); return; }
    const tasks = (data as TaskRow[]) ?? [];
    if (tasks.length === 0) { setItems([]); return; }

    const bookingIds = Array.from(new Set(tasks.map((t) => t.booking_id)));
    const assigneeIds = Array.from(new Set(tasks.map((t) => t.assigned_to).filter(Boolean) as string[]));
    const [bRes, pRes] = await Promise.all([
      supabase.from("bookings").select("id, lead_id, event_date").in("id", bookingIds),
      assigneeIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", assigneeIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string }[], error: null }),
    ]);
    const bookings = (bRes.data ?? []) as { id: string; lead_id: string; event_date: string }[];
    const leadIds = Array.from(new Set(bookings.map((b) => b.lead_id)));
    const lRes = leadIds.length
      ? await supabase.from("leads").select("id, full_name").in("id", leadIds)
      : { data: [] as { id: string; full_name: string }[] };
    const bMap = new Map(bookings.map((b) => [b.id, b]));
    const lMap = new Map((lRes.data ?? []).map((l: any) => [l.id, l.full_name as string]));
    const pMap = new Map(((pRes.data as { id: string; full_name: string }[]) ?? []).map((p) => [p.id, p.full_name]));

    setItems(tasks.map((t) => {
      const b = bMap.get(t.booking_id);
      return applyOverdue({
        ...t,
        lead_id: b?.lead_id ?? null,
        lead_name: b ? (lMap.get(b.lead_id) ?? null) : null,
        event_date: b?.event_date ?? null,
        assignee_name: t.assigned_to ? (pMap.get(t.assigned_to) ?? null) : null,
      });
    }));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeCompanyId, companyFilter, role]);

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
    if (status === "done") toast.success("Task marked done");
  };

  const buckets: Record<Bucket, EnrichedTask[]> = useMemo(() => ({
    pending: filtered?.filter((t) => t.status === "pending") ?? [],
    in_progress: filtered?.filter((t) => t.status === "in_progress") ?? [],
    done: filtered?.filter((t) => t.status === "done") ?? [],
    overdue: filtered?.filter((t) => t.status === "overdue") ?? [],
  }), [filtered]);

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Task board</h1>
          <p className="text-xs text-muted-foreground">Tasks auto-generated from booking templates</p>
        </div>
        {role === "super_admin" && companies.length > 1 && (
          <select
            className="h-10 w-full sm:w-56 rounded-md border border-input bg-background px-3 text-sm"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
          >
            <option value="">All companies</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="mine">My tasks</TabsTrigger>
          <TabsTrigger value="overdue">Overdue<InfoTip tip="overdueFollowUp" className="ml-1" /></TabsTrigger>
          <TabsTrigger value="done">Done</TabsTrigger>
        </TabsList>
      </Tabs>

      {items === null && (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      )}

      {filtered && filtered.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">No tasks here yet.</Card>
      )}

      {/* MOBILE list view */}
      {filtered && filtered.length > 0 && (
        <div className="space-y-2 md:hidden">
          {filtered.map((t) => <TaskCard key={t.id} task={t} onStatus={setStatus} />)}
        </div>
      )}

      {/* DESKTOP kanban */}
      {filtered && filtered.length > 0 && (
        <div className="hidden md:grid md:grid-cols-4 gap-3">
          {(Object.keys(STATUS_META) as Bucket[]).map((b) => (
            <div key={b} className="space-y-2">
              <div className="flex items-center justify-between px-1 text-sm font-medium">
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${b === "overdue" ? "bg-red-500" : b === "done" ? "bg-green-500" : b === "in_progress" ? "bg-blue-500" : "bg-muted-foreground"}`} />
                  {STATUS_META[b].label}
                </span>
                <span className="text-xs text-muted-foreground">{buckets[b].length}</span>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {buckets[b].map((t) => <TaskCard key={t.id} task={t} onStatus={setStatus} kanban />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onStatus, kanban }: { task: EnrichedTask; onStatus: (id: string, s: Bucket) => void; kanban?: boolean }) {
  const meta = STATUS_META[task.status as Bucket];
  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.medium}`} />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{task.title}</div>
          {task.lead_id && task.lead_name && (
            <Link to="/leads/$leadId" params={{ leadId: task.lead_id }} className="text-xs text-muted-foreground hover:underline truncate block">
              {task.lead_name}{task.event_date ? ` · ${task.event_date}` : ""}
            </Link>
          )}
        </div>
        <Badge variant="secondary" className={meta.cls}>{meta.label}</Badge>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDateTimeIN(task.due_at)}</span>
        {task.assignee_name && (
          <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" /> {task.assignee_name}</span>
        )}
      </div>
      {task.status !== "done" && (
        <div className="flex gap-1.5 pt-1">
          {task.status !== "in_progress" && !kanban && (
            <Button size="sm" variant="outline" className="flex-1 h-8" onClick={() => onStatus(task.id, "in_progress")}>Start</Button>
          )}
          <Button size="sm" className="flex-1 h-8" onClick={() => onStatus(task.id, "done")}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Done
          </Button>
        </div>
      )}
      {task.status === "done" && (
        <Button size="sm" variant="ghost" className="w-full h-8 text-xs" onClick={() => onStatus(task.id, "pending")}>Reopen</Button>
      )}
    </Card>
  );
}
