import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Props { companyId: string | undefined }

const STAGES: Array<{ key: string; label: string; defaultDays: number; help: string }> = [
  { key: "new", label: "New enquiry", defaultDays: 2, help: "Without first contact" },
  { key: "in_progress", label: "Getting details", defaultDays: 3, help: "Without requirements saved" },
  { key: "quote_sent", label: "Quote sent", defaultDays: 7, help: "Without client response" },
  { key: "quote_accepted", label: "Quote accepted", defaultDays: 3, help: "Without invoice sent" },
  { key: "no_reply", label: "No reply", defaultDays: 5, help: "Escalates to Super Admin" },
];

type Thresholds = Record<string, number>;

export function ReminderTimingSection({ companyId }: Props) {
  const [enabled, setEnabled] = useState(true);
  const [thresholds, setThresholds] = useState<Thresholds>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    supabase.from("companies")
      .select("stale_alerts_enabled, stale_thresholds")
      .eq("id", companyId).maybeSingle().then(({ data }) => {
        setEnabled((data as any)?.stale_alerts_enabled ?? true);
        const stored = ((data as any)?.stale_thresholds ?? {}) as Thresholds;
        const merged: Thresholds = {};
        STAGES.forEach((s) => { merged[s.key] = Number(stored[s.key] ?? s.defaultDays); });
        setThresholds(merged);
        setLoading(false);
      });
  }, [companyId]);

  if (!companyId) return <div className="text-sm text-muted-foreground p-6">Select a company first.</div>;
  if (loading) return <div className="text-sm text-muted-foreground p-6">Loading…</div>;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("companies")
      .update({ stale_alerts_enabled: enabled, stale_thresholds: thresholds as any })
      .eq("id", companyId);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Saved ✓");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border rounded-md p-3">
        <div>
          <div className="font-semibold text-sm">Enable stale lead alerts</div>
          <div className="text-xs text-muted-foreground">Notify admin (and SA on No-reply) when a lead stalls.</div>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Stale lead thresholds per stage</h4>
        {STAGES.map((s) => (
          <div key={s.key} className="grid grid-cols-[1fr_120px] gap-3 items-end border rounded-md p-3">
            <div>
              <Label className="text-sm">{s.label}</Label>
              <div className="text-xs text-muted-foreground">{s.help}</div>
            </div>
            <div className="flex items-center gap-1">
              <Input type="number" min={1} max={60} value={thresholds[s.key] ?? s.defaultDays}
                onChange={(e) => setThresholds({ ...thresholds, [s.key]: Math.max(1, Number(e.target.value) || s.defaultDays) })}
                className="h-10" disabled={!enabled} />
              <span className="text-xs text-muted-foreground">days</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}
