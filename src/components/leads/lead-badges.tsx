import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["lead_status"];
type Score = Database["public"]["Enums"]["lead_score"];
type Source = Database["public"]["Enums"]["lead_source"];

const STATUS_LABEL: Record<Status, string> = {
  new: "New",
  in_progress: "In progress",
  neutral: "Neutral",
  positive: "Positive",
  negative: "Negative",
  closed: "Closed",
  unresponsive: "Unresponsive",
  locked: "Locked",
};

const STATUS_CLASS: Record<Status, string> = {
  new: "bg-primary/15 text-primary border-primary/30",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  neutral: "bg-muted text-muted-foreground border-border",
  positive: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  negative: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  closed: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  unresponsive: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  locked: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
};

const SCORE_CLASS: Record<Score, string> = {
  hot: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  warm: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  cold: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
};

const SOURCE_LABEL: Record<Source, string> = {
  inbound_call: "Inbound call",
  walkin: "Walk-in",
  referral: "Referral",
  portal: "Portal",
  manual: "Manual",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_CLASS[status])}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function ScoreBadge({ score }: { score: Score }) {
  return (
    <Badge variant="outline" className={cn("uppercase text-[10px] font-semibold", SCORE_CLASS[score])}>
      {score}
    </Badge>
  );
}

export function SourceLabel({ source }: { source: Source }) {
  return <span className="text-xs text-muted-foreground">{SOURCE_LABEL[source]}</span>;
}

export const STATUS_LABELS = STATUS_LABEL;
export const SOURCE_LABELS = SOURCE_LABEL;
