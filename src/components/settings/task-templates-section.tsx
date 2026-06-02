import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { OFFSET_OPTIONS, type TaskTemplate } from "@/lib/task-templates";

interface Staff { id: string; full_name: string }

export function TaskTemplatesSection({ companyId }: { companyId: string }) {
  const [items, setItems] = useState<TaskTemplate[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      supabase.from("companies").select("task_templates").eq("id", companyId).maybeSingle(),
      supabase.from("profiles").select("id, full_name").eq("company_id", companyId).eq("is_active", true),
    ]).then(([c, s]) => {
      if (!active) return;
      const tpl = ((c.data?.task_templates as unknown) ?? []) as TaskTemplate[];
      setItems(Array.isArray(tpl) ? tpl : []);
      setStaff((s.data as Staff[]) ?? []);
      setLoading(false);
    });
    return () => { active = false; };
  }, [companyId]);

  const update = (i: number, patch: Partial<TaskTemplate>) =>
    setItems((arr) => arr.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  const remove = (i: number) => setItems((arr) => arr.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => setItems((arr) => {
    const j = i + dir; if (j < 0 || j >= arr.length) return arr;
    const next = arr.slice(); [next[i], next[j]] = [next[j]!, next[i]!]; return next;
  });
  const add = () => setItems((arr) => [...arr, { title: "", when: "7d_before", priority: "medium", assigned_to: null, assign_to_role: "any_available" }]);

  const save = async () => {
    setSaving(true);
    const clean = items.filter((t) => t.title.trim().length > 0);
    const { error } = await supabase.from("companies").update({ task_templates: clean as any }).eq("id", companyId);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Task templates saved");
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      {items.length === 0 && (
        <div className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
          No templates yet. Add one to auto-generate tasks for every confirmed booking.
        </div>
      )}
      {items.map((t, i) => (
        <div key={i} className="border rounded-md p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Task name</Label>
              <Input value={t.title} onChange={(e) => update(i, { title: e.target.value })} placeholder="e.g. Confirm catering count" />
            </div>
            <div>
              <Label>When</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={t.when}
                onChange={(e) => update(i, { when: e.target.value as TaskTemplate["when"] })}
              >
                {OFFSET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {t.when === "custom" && (
              <div>
                <Label>Hours before event</Label>
                <Input type="number" value={t.custom_hours ?? 24} onChange={(e) => update(i, { custom_hours: Number(e.target.value) })} />
              </div>
            )}
            <div>
              <Label>Assign to</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={t.assigned_to ?? ""}
                onChange={(e) => update(i, { assigned_to: e.target.value || null })}
              >
                <option value="">Unassigned</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <div>
              <Label>Priority</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={t.priority ?? "medium"}
                onChange={(e) => update(i, { priority: e.target.value as TaskTemplate["priority"] })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea rows={2} value={t.description ?? ""} onChange={(e) => update(i, { description: e.target.value })} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="outline" onClick={() => move(i, 1)} disabled={i === items.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
            </div>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4 mr-1" /> Remove
            </Button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 justify-between">
        <Button variant="outline" onClick={add}><Plus className="h-4 w-4 mr-1" /> Add task template</Button>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save templates"}</Button>
      </div>
    </div>
  );
}
