import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, GripVertical, X, ArrowUp, ArrowDown } from "lucide-react";

export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "time";
  placeholder?: string;
  width?: string; // e.g. "w-32"
};

interface Props {
  companyId: string | undefined;
  column: string; // jsonb column on companies
  fields: FieldDef[];
  emptyText?: string;
  addLabel?: string;
  reorder?: boolean;
}

export function JsonListSection({
  companyId,
  column,
  fields,
  emptyText = "No entries yet.",
  addLabel = "Add",
  reorder = true,
}: Props) {
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    supabase
      .from("companies")
      .select(column)
      .eq("id", companyId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error("Couldn't load");
        const val = (data as any)?.[column];
        setRows(Array.isArray(val) ? val : []);
        setLoading(false);
      });
  }, [companyId, column]);

  if (!companyId)
    return <div className="text-sm text-muted-foreground p-6">Select a company first.</div>;
  if (loading) return <div className="text-sm text-muted-foreground p-6">Loading…</div>;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("companies")
      .update({ [column]: rows as any })
      .eq("id", companyId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saved ✓");
  };

  const updateRow = (i: number, patch: Record<string, any>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number) => setRows(rows.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  };
  const addRow = () => {
    const empty: Record<string, any> = {};
    fields.forEach((f) => (empty[f.key] = f.type === "number" ? 0 : ""));
    setRows([...rows, empty]);
  };

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <div className="text-sm text-muted-foreground border border-dashed rounded-md p-8 text-center">
          {emptyText}
        </div>
      )}
      {rows.map((row, i) => (
        <div
          key={i}
          className="grid gap-2 items-end border rounded-md p-3"
          style={{ gridTemplateColumns: `auto repeat(${fields.length}, minmax(0,1fr)) auto` }}
        >
          {reorder ? (
            <div className="flex flex-col gap-1 pt-5">
              <button
                type="button"
                onClick={() => move(i, -1)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Move up"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Move down"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          )}
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5 min-w-0">
              <Label className="text-xs">{f.label}</Label>
              <Input
                type={f.type ?? "text"}
                value={row[f.key] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) =>
                  updateRow(i, {
                    [f.key]:
                      f.type === "number" ? Number(e.target.value) || 0 : e.target.value,
                  })
                }
              />
            </div>
          ))}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeRow(i)}
            aria-label="Remove"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4 mr-1" />
          {addLabel}
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
