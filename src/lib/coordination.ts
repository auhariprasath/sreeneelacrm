import type { LucideIcon } from "lucide-react";
import { UserCheck, ClipboardCheck, PackageCheck, MapPin, PlayCircle, CheckCircle2 } from "lucide-react";

export type CoordinationStage =
  | "coordinator_assigned"
  | "requirements_reviewed"
  | "preparations_started"
  | "venue_ready"
  | "event_started"
  | "event_completed";

export const STAGE_ORDER: CoordinationStage[] = [
  "coordinator_assigned",
  "requirements_reviewed",
  "preparations_started",
  "venue_ready",
  "event_started",
  "event_completed",
];

export const STAGE_META: Record<CoordinationStage, { label: string; short: string; icon: LucideIcon }> = {
  coordinator_assigned: { label: "Coordinator assigned",  short: "Assigned",     icon: UserCheck },
  requirements_reviewed:{ label: "Requirements reviewed", short: "Reviewed",     icon: ClipboardCheck },
  preparations_started: { label: "Preparations started",  short: "Preparing",    icon: PackageCheck },
  venue_ready:          { label: "Venue ready",           short: "Venue ready",  icon: MapPin },
  event_started:        { label: "Event started",         short: "Started",      icon: PlayCircle },
  event_completed:      { label: "Event completed",       short: "Completed",    icon: CheckCircle2 },
};
