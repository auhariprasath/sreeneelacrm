import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CompanyField = {
  key: string;
  label: string;
  type?: "text" | "number" | "textarea" | "switch" | "company_type";
  placeholder?: string;
  description?: string;
  suffix?: string;
  rows?: number;
  fullWidth?: boolean;
};

const COMPANY_TYPES = [
  { value: "garden_venue", label: "Garden Venue" },
  { value: "banquet_hall", label: "Banquet Hall" },
  { value: "party_hall", label: "Party Hall" },
  { value: "mandapam", label: "Mandapam" },
  { value: "other", label: "Other" },
] as const;

type CompanyTypeValue = (typeof COMPANY_TYPES)[number]["value"];
type CompanyDataValue = string | number | boolean | null;
type CompanyFormData = Record<string, CompanyDataValue | undefined>;

const COMPANY_TYPE_VALUES = new Set<string>(COMPANY_TYPES.map((type) => type.value));

function normalizeCompanyType(value: unknown): { type: CompanyTypeValue; customType: string | null } {
  const raw = String(value ?? "").trim();
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const aliases: Record<string, CompanyTypeValue> = {
    garden: "garden_venue",
    garden_venue: "garden_venue",
    banquet: "banquet_hall",
    banquet_hall: "banquet_hall",
    party: "party_hall",
    party_hall: "party_hall",
    mandapam: "mandapam",
    other: "other",
  };
  const mapped = aliases[normalized] ?? (COMPANY_TYPE_VALUES.has(normalized) ? (normalized as CompanyTypeValue) : "other");
  return {
    type: mapped,
    customType: mapped === "other" && normalized !== "other" ? raw || null : null,
  };
}

interface Props {
  companyId: string | undefined;
  fields: CompanyField[];
}

export function CompanyFieldsSection({ companyId, fields }: Props) {
  const [data, setData] = useState<CompanyFormData | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    const cols = Array.from(
      new Set(
        fields.flatMap((f) => (f.type === "company_type" ? [f.key, "custom_type"] : [f.key])),
      ),
    ).join(",");
    supabase
      .from("companies")
      .select(cols)
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error("Couldn't load");
        setData((data ?? {}) as CompanyFormData);
      });
  }, [companyId, fields]);

  if (!companyId)
    return <div className="text-sm text-muted-foreground p-6">Select a company first.</div>;
  if (!data) return <div className="text-sm text-muted-foreground p-6">Loading…</div>;

  const update = (k: string, v: CompanyDataValue) => setData({ ...data, [k]: v });

  const save = async () => {
    setSaving(true);
    const patch: Record<string, CompanyDataValue> = {};
    fields.forEach((f) => {
      let v = data[f.key];
      if (f.type === "number") v = v === "" || v === null ? null : Number(v);
      if (f.type === "company_type") {
        const normalized = normalizeCompanyType(v);
        patch[f.key] = normalized.type;
        patch.custom_type =
          normalized.type === "other" ? String(data.custom_type || normalized.customType || "").trim() || null : null;
        return;
      }
      patch[f.key] = v ?? null;
    });
    const { error } = await supabase.from("companies").update(patch as never).eq("id", companyId);
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
        if (f.type === "company_type") {
          const normalized = normalizeCompanyType(data[f.key]);
          return (
            <div key={f.key} className={`space-y-1.5 ${span}`}>
              <Label>{f.label}</Label>
              <Select
                value={normalized.type}
                onValueChange={(v) => setData({ ...data, [f.key]: v, custom_type: v === "other" ? data.custom_type : null })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPANY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {normalized.type === "other" && (
                <Input
                  value={data.custom_type ?? normalized.customType ?? ""}
                  placeholder="Describe the venue type"
                  onChange={(e) => update("custom_type", e.target.value)}
                />
              )}
              {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
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
