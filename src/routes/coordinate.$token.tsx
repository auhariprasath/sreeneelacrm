import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { formatDateIN, formatTimeOfDay } from "@/lib/format";
import { STAGE_ORDER, STAGE_META, type CoordinationStage } from "@/lib/coordination";
import {
  getCoordinationByCoordinatorToken,
  addCoordinationUpdate,
} from "@/lib/api/coordination-public.functions";

export const Route = createFileRoute("/coordinate/$token")({ component: CoordinatePage });

function CoordinatePage() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState<CoordinationStage | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await getCoordinationByCoordinatorToken({ data: { token } });
    setData(res);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

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
  const nextStage: CoordinationStage | null = STAGE_ORDER[lastDoneIdx + 1] ?? null;

  const tap = async (s: CoordinationStage) => {
    if (doneMap.has(s)) return;
    if (s !== nextStage) { toast.error("Complete earlier stages first"); return; }
    setSaving(s);
    const r = await addCoordinationUpdate({ data: { token, stage: s } });
    setSaving(null);
    if (!r.ok) { toast.error(r.error || "Failed"); return; }
    toast.success(STAGE_META[s].label);
    load();
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-md mx-auto space-y-4 py-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{coordinator?.full_name ?? "Coordinator"}</CardTitle>
            <CardDescription>Update each stage as it happens.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {lead?.full_name && <div><span className="text-muted-foreground">Client:</span> <span className="font-medium">{lead.full_name}</span></div>}
            {lead?.event_type && <div><span className="text-muted-foreground">Event:</span> <span className="font-medium">{lead.event_type}</span></div>}
            <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{formatDateIN(booking.event_date)}</span></div>
            {booking.start_time && <div><span className="text-muted-foreground">Time:</span> <span className="font-medium">{formatTimeOfDay(booking.start_time)}</span></div>}
            {booking.venue && <div><span className="text-muted-foreground">Venue:</span> <span className="font-medium">{booking.venue}</span></div>}
          </CardContent>
        </Card>

        <div className="space-y-3">
          {STAGE_ORDER.map((s) => {
            const u = doneMap.get(s);
            const done = !!u;
            const isNext = nextStage === s;
            const Icon = STAGE_META[s].icon;
            return (
              <button
                key={s}
                onClick={() => tap(s)}
                disabled={done || !isNext || saving !== null}
                className={`w-full min-h-[72px] rounded-lg border-2 p-4 flex items-center gap-3 text-left transition-all
                  ${done ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300" :
                    isNext ? "bg-primary border-primary text-primary-foreground hover:opacity-90" :
                    "bg-muted/40 border-muted text-muted-foreground"}`}
              >
                {done ? <Check className="h-6 w-6 shrink-0" /> : <Icon className="h-6 w-6 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{STAGE_META[s].label}</div>
                  {done && <div className="text-xs opacity-80">✓ {new Date(u.updated_at).toLocaleString()}</div>}
                  {isNext && !done && <div className="text-xs opacity-90">Tap when ready</div>}
                </div>
                {saving === s && <Loader2 className="h-5 w-5 animate-spin" />}
              </button>
            );
          })}
        </div>

        <div className="text-center text-xs text-muted-foreground pt-4">
          Powered by {company?.name ?? "Neela CRM"}
        </div>
      </div>
    </div>
  );
}
