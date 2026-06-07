import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, Fragment } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check } from "lucide-react";
import { formatDateIN, formatTimeOfDay } from "@/lib/format";
import { STAGE_ORDER, STAGE_META, type CoordinationStage } from "@/lib/coordination";
import { getCoordinationByClientToken } from "@/lib/api/coordination-public.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/event-status/$token")({ component: EventStatusPage });

function EventStatusPage() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const load = async () => {
    const res = await getCoordinationByClientToken({ data: { token } });
    setData(res);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Subscribe to all updates and refresh; server filters by token on next fetch.
    const ch = supabase
      .channel(`event-status-${token}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_coordination_updates" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data?.coord) return (
    <div className="min-h-screen flex items-center justify-center p-4 text-center">
      <div>
        <div className="text-xl font-semibold">Link expired or invalid</div>
        <div className="text-sm text-muted-foreground mt-2">Please contact the team for a fresh link.</div>
      </div>
    </div>
  );

  const { booking, lead, company, coordinator, updates } = data;
  const doneMap = new Map<string, any>((updates as any[]).map((u) => [u.stage, u]));
  const lastDoneIdx = STAGE_ORDER.reduce((acc, s, i) => doneMap.has(s) ? i : acc, -1);
  const currentIdx = Math.min(lastDoneIdx + 1, STAGE_ORDER.length - 1);

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-md mx-auto space-y-4 py-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Your event progress</CardTitle>
            <CardDescription>Live updates from your coordinator.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {lead?.full_name && <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{lead.full_name}</span></div>}
            {lead?.event_type && <div><span className="text-muted-foreground">Event:</span> <span className="font-medium">{lead.event_type}</span></div>}
            <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{formatDateIN(booking.event_date)}</span></div>
            {booking.start_time && <div><span className="text-muted-foreground">Time:</span> <span className="font-medium">{formatTimeOfDay(booking.start_time)}</span></div>}
            {booking.venue && <div><span className="text-muted-foreground">Venue:</span> <span className="font-medium">{booking.venue}</span></div>}
            {coordinator?.full_name && <div className="pt-2 border-t mt-2 text-xs"><span className="text-muted-foreground">Coordinator:</span> <span className="font-medium">{coordinator.full_name}</span></div>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="overflow-x-auto pb-2">
              <div className="flex items-center min-w-max">
                {STAGE_ORDER.map((s, i) => {
                  const u = doneMap.get(s);
                  const done = !!u;
                  const isCurrent = !done && i === currentIdx;
                  const Icon = STAGE_META[s].icon;
                  return (
                    <Fragment key={s}>
                      <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2
                          ${done ? "bg-success border-success text-white" :
                            isCurrent ? "bg-primary border-primary text-primary-foreground ring-4 ring-primary/25" :
                            "bg-muted border-muted text-muted-foreground"}`}>
                          {done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                        </div>
                        <div className={`text-[11px] text-center leading-tight px-1 ${done ? "text-success dark:text-success" : isCurrent ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                          {STAGE_META[s].short}
                        </div>
                        {done && (
                          <div className="text-[10px] text-muted-foreground">{new Date(u.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                        )}
                      </div>
                      {i < STAGE_ORDER.length - 1 && (
                        <div className={`h-0.5 w-6 mt-[-26px] ${i < lastDoneIdx ? "bg-success" : "bg-muted"}`} />
                      )}
                    </Fragment>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground pt-2">
          Powered by {company?.name ?? "Neela CRM"}
        </div>
      </div>
    </div>
  );
}
