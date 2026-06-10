import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Globe } from "lucide-react";

type Integration = {
  id: string;
  name: string;
  type: string;
  api_key?: string;
  webhook_url?: string;
  notes?: string;
  enabled: boolean;
};

const PRESET_TYPES = [
  "IndiaMART",
  "JustDial",
  "Sulekha",
  "Google Ads",
  "Razorpay",
  "WhatsApp Business API",
  "Custom / Other",
];

const empty = (): Integration => ({
  id: Math.random().toString(36).slice(2),
  name: "",
  type: "Custom / Other",
  api_key: "",
  webhook_url: "",
  notes: "",
  enabled: true,
});

interface Props { companyId: string | undefined }

export function IntegrationsSection({ companyId }: Props) {
  const [items, setItems] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    supabase.from("companies").select("integrations").eq("id", companyId).maybeSingle().then(({ data }) => {
      const raw = (data as any)?.integrations;
      setItems(Array.isArray(raw) ? raw : []);
      setLoading(false);
    });
  }, [companyId]);

  if (!companyId) return <div className="text-sm text-muted-foreground p-6">Select a company first.</div>;
  if (loading) return <div className="text-sm text-muted-foreground p-6">Loading…</div>;

  const update = (id: string, patch: Partial<Integration>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("companies").update({ integrations: items as any }).eq("id", companyId);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Integrations saved ✓");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add any third-party service your venue uses. API keys and webhook URLs are stored per company and not shared.
      </p>

      {items.length === 0 && (
        <div className="border border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground">
          <Globe className="h-6 w-6 mx-auto mb-2 opacity-40" />
          No integrations added yet.
        </div>
      )}

      <div className="space-y-3">
        {items.map((it) => (
          <div key={it.id} className="border rounded-lg p-4 space-y-3 bg-card">
            <div className="flex items-start gap-3">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Integration type</Label>
                  <Select value={it.type} onValueChange={(v) => update(it.id, { type: v, name: it.name || (v !== "Custom / Other" ? v : "") })}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Display name</Label>
                  <Input
                    value={it.name}
                    onChange={(e) => update(it.id, { name: e.target.value })}
                    placeholder={it.type !== "Custom / Other" ? it.type : "e.g. My Portal"}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">API key / Token (optional)</Label>
                  <Input
                    value={it.api_key ?? ""}
                    onChange={(e) => update(it.id, { api_key: e.target.value })}
                    placeholder="Paste key here"
                    className="h-9 font-mono text-xs"
                    type="password"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Webhook URL (optional)</Label>
                  <Input
                    value={it.webhook_url ?? ""}
                    onChange={(e) => update(it.id, { webhook_url: e.target.value })}
                    placeholder="https://…"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Notes (optional)</Label>
                  <Input
                    value={it.notes ?? ""}
                    onChange={(e) => update(it.id, { notes: e.target.value })}
                    placeholder="e.g. Used for lead capture from portal"
                    className="h-9"
                  />
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 pt-5">
                <button
                  type="button"
                  onClick={() => update(it.id, { enabled: !it.enabled })}
                  className={`h-6 w-11 rounded-full transition-colors ${it.enabled ? "bg-primary" : "bg-muted"} relative`}
                  title={it.enabled ? "Enabled" : "Disabled"}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-card dark:bg-foreground shadow transition-transform ${it.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, empty()])}>
          <Plus className="h-4 w-4 mr-1" /> Add integration
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save integrations"}
        </Button>
      </div>
    </div>
  );
}
