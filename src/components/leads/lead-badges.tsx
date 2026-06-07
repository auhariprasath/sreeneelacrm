import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["lead_status"];
type Score = Database["public"]["Enums"]["lead_score"];
type Source = Database["public"]["Enums"]["lead_source"];

import { LEAD_STATUS_LABEL } from "@/lib/labels";

const STATUS_LABEL = LEAD_STATUS_LABEL;

const STATUS_CLASS: Record<Status, string> = {
  new: "bg-primary/15 text-primary border-primary/30",
  in_progress: "bg-info/15 text-info  border-info/30",
  neutral: "bg-muted text-muted-foreground border-border",
  positive: "bg-success/15 text-success dark:text-success border-success/30",
  negative: "bg-destructive/15 text-destructive dark:text-destructive border-destructive/30",
  closed: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  unresponsive: "bg-warning/15 text-warning dark:text-warning border-warning/30",
  locked: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
};

const SCORE_CLASS: Record<Score, string> = {
  hot: "bg-destructive/15 text-destructive dark:text-destructive border-destructive/30",
  warm: "bg-warning/15 text-warning dark:text-warning border-warning/30",
  cold: "bg-info/15 text-info  ",
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
