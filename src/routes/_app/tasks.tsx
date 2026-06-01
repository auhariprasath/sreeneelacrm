import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, Phone, MessageSquare, CalendarClock, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { formatDateTimeIN, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/_app/tasks")({ component: TasksPage });

type FollowUpRow = {
  id: string;
  lead_id: string;
  type: "call" | "whatsapp" | "site_visit" | "custom";
  note: string | null;
  scheduled_at: string;
  is_sent: boolean;
  is_cancelled: boolean;
  leads: { full_name: string; phone: string; company_id: string } | null;
};

const TYPE_ICON = {
  call: Phone,
  whatsapp: MessageSquare,
  site_visit: CalendarClock,
  custom: ListTodo,
} as const;

function bucketize(items: FollowUpRow[]) {
  const now = Date.now();
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const overdue: FollowUpRow[] = [];
  const today: FollowUpRow[] = [];
  const upcoming: FollowUpRow[] = [];
  for (const f of items) {
    const t = new Date(f.scheduled_at).getTime();
    if (t < startOfToday.getTime()) overdue.push(f);
    else if (t <= endOfToday.getTime()) today.push(f);
    else upcoming.push(f);
    void now;
  }
  return { overdue, today, upcoming };
}

function TasksPage() {
  const { role, companies, activeCompanyId } = useAuth();
  const companyId = role === "super_admin" ? activeCompanyId : companies[0]?.id ?? null;
  const [items, setItems] = useState<FollowUpRow[] | null>(null);

  const load = async () => {
    if (!companyId) { setItems([]); return; }
    const { data } = await supabase
      .from("follow_ups")
      .select("id, lead_id, type, note, scheduled_at, is_sent, is_cancelled, leads!inner(full_name, phone, company_id)")
      .eq("is_sent", false).eq("is_cancelled", false)
      .eq("leads.company_id", companyId)
      .order("scheduled_at", { ascending: true })
      .limit(200);
    setItems((data as unknown as FollowUpRow[]) ?? []);
  };

  useEffect(() => { setItems(null); load(); /* eslint-disable-next-line */ }, [companyId]);

  const markDone = async (id: string) => {
    const { error } = await supabase.from("follow_ups").update({ is_sent: true }).eq("id", id);
    if (error) return toast.error("Could not mark complete");
    toast.success("Marked done");
    load();
  };
  const cancel = async (id: string) => {
    const { error } = await supabase.from("follow_ups").update({ is_cancelled: true }).eq("id", id);
    if (error) return toast.error("Could not cancel");
    toast.success("Cancelled");
    load();
  };

  if (items === null) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Skeleton className="h-8 w-48" />
        {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  const { overdue, today, upcoming } = bucketize(items);

  const Section = ({ title, list, tone }: { title: string; list: FollowUpRow[]; tone?: "danger" }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`text-base ${tone === "danger" ? "text-destructive" : ""}`}>
          {title} <span className="text-muted-foreground font-normal">({list.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {list.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing here</div>
        ) : (
          <ul className="divide-y">
            {list.map((f) => {
              const Icon = TYPE_ICON[f.type] ?? ListTodo;
              return (
                <li key={f.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-accent text-accent-foreground flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{f.leads?.full_name ?? "Lead"}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTimeIN(f.scheduled_at)} · {relativeTime(f.scheduled_at)}
                    </div>
                    {f.note && <div className="text-xs mt-1 line-clamp-2">{f.note}</div>}
                  </div>
                  <div className="flex gap-2 sm:flex-row">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/leads/$leadId" params={{ leadId: f.lead_id }}>Open</Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => markDone(f.id)}>
                      <Check className="h-4 w-4 mr-1" /> Done
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => cancel(f.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <p className="text-sm text-muted-foreground">Follow-ups across all your leads</p>
      </div>
      <Section title="Overdue" list={overdue} tone="danger" />
      <Section title="Today" list={today} />
      <Section title="Upcoming" list={upcoming} />
    </div>
  );
}
