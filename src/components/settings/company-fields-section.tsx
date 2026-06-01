import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export type CompanyField = {
  key: string;
  label: string;
  type?: "text" | "number" | "textarea" | "switch";
  placeholder?: string;
  description?: string;
  suffix?: string;
  rows?: number;
  fullWidth?: boolean;
};

interface Props {
  companyId: string | undefined;
  fields: CompanyField[];
}

export function CompanyFieldsSection({ companyId, fields }: Props) {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    const cols = fields.map((f) => f.key).join(",");
    supabase
      .from("companies")
      .select(cols)
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error("Couldn't load");
        setData((data as any) ?? {});
      });
  }, [companyId, fields]);

  if (!companyId)
    return <div className="text-sm text-muted-foreground p-6">Select a company first.</div>;
  if (!data) return <div className="text-sm text-muted-foreground p-6">Loading…</div>;

  const update = (k: string, v: any) => setData({ ...data, [k]: v });

  const save = async () => {
    setSaving(true);
    const patch: Record<string, any> = {};
    fields.forEach((f) => {
      let v = data[f.key];
      if (f.type === "number") v = v === "" || v === null ? null : Number(v);
      patch[f.key] = v ?? null;
    });
    const { error } = await supabase.from("companies").update(patch).eq("id", companyId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saved ✓");
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map((f) => {
        const span = f.fullWidth || f.type === "textarea" ? "md:col-span-2" : "";
        if (f.type === "switch") {
          return (
            <div key={f.key} className={`flex items-start justify-between gap-4 border rounded-md p-3 ${span}`}>
              <div className="space-y-0.5 min-w-0">
                <Label>{f.label}</Label>
                {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
              </div>
              <Switch checked={!!data[f.key]} onCheckedChange={(v) => update(f.key, v)} />
            </div>
          );
        }
        return (
          <div key={f.key} className={`space-y-1.5 ${span}`}>
            <Label>{f.label}</Label>
            {f.type === "textarea" ? (
              <Textarea
                rows={f.rows ?? 4}
                value={data[f.key] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => update(f.key, e.target.value)}
              />
            ) : (
              <div className="relative">
                <Input
                  type={f.type === "number" ? "number" : "text"}
                  value={data[f.key] ?? ""}
                  placeholder={f.placeholder}
                  onChange={(e) => update(f.key, e.target.value)}
                />
                {f.suffix && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {f.suffix}
                  </span>
                )}
              </div>
            )}
            {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
          </div>
        );
      })}
      <div className="md:col-span-2 flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
