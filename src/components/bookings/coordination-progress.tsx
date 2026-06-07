import { useEffect, useState, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check } from "lucide-react";
import { STAGE_ORDER, STAGE_META, type CoordinationStage } from "@/lib/coordination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Update { stage: CoordinationStage; updated_at: string; updated_by: string | null }
interface Coord { id: string; coordinator_id: string }

interface Props {
  bookingId: string;
  /** When provided, the component reads from the loaded data; otherwise it queries. */
}

export function CoordinationProgress({ bookingId }: Props) {
  const [coord, setCoord] = useState<Coord | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [coordinatorName, setCoordinatorName] = useState<string | null>(null);

  const load = async () => {
    const { data: c } = await supabase
      .from("event_coordination" as any)
      .select("id, coordinator_id")
      .eq("booking_id", bookingId)
      .maybeSingle();
    if (!c) { setCoord(null); setUpdates([]); return; }
    const cc = c as any;
    setCoord({ id: cc.id, coordinator_id: cc.coordinator_id });
    const [{ data: ups }, { data: who }] = await Promise.all([
      supabase.from("event_coordination_updates" as any)
        .select("stage,updated_at,updated_by")
        .eq("coordination_id", cc.id)
        .order("updated_at", { ascending: true }),
      supabase.from("profiles").select("full_name").eq("id", cc.coordinator_id).maybeSingle(),
    ]);
    setUpdates(((ups as any[]) ?? []) as Update[]);
    setCoordinatorName(((who as any)?.full_name) ?? null);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`coord-${bookingId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_coordination_updates" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "event_coordination" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  if (!coord) return null;

  const doneMap = new Map(updates.map((u) => [u.stage, u]));
  const lastDoneIdx = STAGE_ORDER.reduce((acc, s, i) => doneMap.has(s) ? i : acc, -1);
  const currentIdx = Math.min(lastDoneIdx + 1, STAGE_ORDER.length - 1);

  return (
    <div className="border-t pt-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Coordination</div>
        {coordinatorName && (
          <div className="text-[11px] text-muted-foreground">Coordinator: <span className="font-medium text-foreground">{coordinatorName}</span></div>
        )}
      </div>
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div className="flex items-center min-w-max gap-0">
          {STAGE_ORDER.map((s, i) => {
            const meta = STAGE_META[s];
            const u = doneMap.get(s);
            const done = !!u;
            const isCurrent = !done && i === currentIdx;
            const Icon = meta.icon;
            const bubble = (
              <button
                type="button"
                className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all
                  ${done ? "bg-emerald-500 border-emerald-500 text-white" :
                    isCurrent ? "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20" :
                    "bg-muted border-muted text-muted-foreground"}`}
                aria-label={meta.label}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </button>
            );
            return (
              <Fragment key={s}>
                <div className="flex flex-col items-center gap-1 min-w-[68px]">
                  {done ? (
                    <Popover>
                      <PopoverTrigger asChild>{bubble}</PopoverTrigger>
                      <PopoverContent className="w-56 text-xs">
                        <div className="font-medium">{meta.label}</div>
                        <div className="text-muted-foreground mt-1">
                          {new Date(u.updated_at).toLocaleString()}
                        </div>
                        {coordinatorName && (
                          <div className="text-muted-foreground">by {coordinatorName}</div>
                        )}
                      </PopoverContent>
                    </Popover>
                  ) : bubble}
                  <div className={`text-[10px] text-center leading-tight ${done ? "text-emerald-700 dark:text-emerald-400" : isCurrent ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    {meta.short}
                  </div>
                </div>
                {i < STAGE_ORDER.length - 1 && (
                  <div className={`h-0.5 w-6 mt-[-14px] ${i < lastDoneIdx ? "bg-emerald-500" : "bg-muted"}`} />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
