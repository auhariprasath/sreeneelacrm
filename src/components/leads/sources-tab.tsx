import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTimeIN } from "@/lib/format";
import { Megaphone, UserCircle2, Clock, Tag, History } from "lucide-react";

interface Props {
  leadId: string;
  source: string;
  createdAt: string;
  createdBy: string | null;
}

type Campaign = { id: string; name: string; channel_used: string; created_at: string };
type Change = { id: string; action: string; note: string | null; created_at: string; performed_by: string | null };

export function SourcesTab({ leadId, source, createdAt, createdBy }: Props) {
  const [creator, setCreator] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      if (createdBy) {
        const { data } = await supabase.from("profiles").select("full_name").eq("id", createdBy).maybeSingle();
        setCreator((data as any)?.full_name ?? null);
      }

      const { data: cls } = await supabase
        .from("campaign_leads")
        .select("id, campaign_id, channel_used, created_at, campaigns(name)")
        .eq("lead_id", leadId);
      setCampaigns(
        ((cls as any[]) ?? []).map((c) => ({
          id: c.id,
          name: c.campaigns?.name ?? "Campaign",
          channel_used: c.channel_used,
          created_at: c.created_at,
        })),
      );

      const { data: logs } = await supabase
        .from("activity_logs")
        .select("id, action, note, created_at, performed_by")
        .eq("lead_id", leadId)
        .ilike("action", "%source%")
        .order("created_at", { ascending: false });
      const arr = (logs as Change[]) ?? [];
      setChanges(arr);

      const ids = Array.from(new Set(arr.map((c) => c.performed_by).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        const map: Record<string, string> = {};
        for (const p of (profs as any[]) ?? []) map[p.id] = p.full_name;
        setStaffNames(map);
      }
    })();
  }, [leadId, createdBy]);

  return (
    <div className="space-y-3 pt-3">
      <div className="bg-card border rounded-md p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Tag className="h-3.5 w-3.5" /> Origin
        </div>
        <Row icon={<Megaphone className="h-3.5 w-3.5" />} label="Source" value={source.replace(/_/g, " ")} />
        <Row icon={<Clock className="h-3.5 w-3.5" />} label="First contact" value={formatDateTimeIN(createdAt)} />
        <Row icon={<UserCircle2 className="h-3.5 w-3.5" />} label="First handled by" value={creator ?? (createdBy ? "—" : "System / inbound")} />
      </div>

      {campaigns.length > 0 && (
        <div className="bg-card border rounded-md p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Megaphone className="h-3.5 w-3.5" /> Campaigns
          </div>
          {campaigns.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-[11px] text-muted-foreground">via {c.channel_used.replace(/_/g, " ")} · {formatDateTimeIN(c.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-card border rounded-md p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <History className="h-3.5 w-3.5" /> Source changes
        </div>
        {changes.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">No source changes logged.</div>
        ) : (
          <ol className="space-y-2">
            {changes.map((c) => (
              <li key={c.id} className="text-sm">
                <div className="font-medium">{c.action}</div>
                {c.note && <div className="text-xs text-muted-foreground whitespace-pre-wrap">{c.note}</div>}
                <div className="text-[11px] text-muted-foreground">
                  {formatDateTimeIN(c.created_at)}
                  {c.performed_by && staffNames[c.performed_by] && <> · by {staffNames[c.performed_by]}</>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-xs text-muted-foreground flex items-center gap-1.5">{icon} {label}</span>
      <span className="font-medium capitalize text-right">{value}</span>
    </div>
  );
}
