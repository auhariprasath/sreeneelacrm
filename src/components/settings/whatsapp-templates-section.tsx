import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  CATEGORY_LABELS, PLACEHOLDERS, WA_TEMPLATES, renderPreview,
  type WaTemplateCategory, type WaTemplateDef, type WaTemplatesMap,
} from "@/lib/wa-templates";

interface Props { companyId: string }

const CATEGORY_ORDER: WaTemplateCategory[] = [
  "lead_capture", "follow_up", "quotation", "booking_payment",
  "event_reminders", "post_event", "meetings", "tasks_coordination",
];

export function WhatsappTemplatesSection({ companyId }: Props) {
  const [values, setValues] = useState<WaTemplatesMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase.from("companies").select("wa_templates").eq("id", companyId).maybeSingle().then(({ data }) => {
      if (!active) return;
      const stored = ((data?.wa_templates as unknown) ?? {}) as WaTemplatesMap;
      const next: WaTemplatesMap = {};
      WA_TEMPLATES.forEach((t) => {
        next[t.key] = {
          body: stored[t.key]?.body ?? t.defaultBody,
          autoSend: stored[t.key]?.autoSend ?? false,
        };
      });
      setValues(next);
      setLoading(false);
    });
    return () => { active = false; };
  }, [companyId]);

  const grouped = useMemo(() => {
    const m = new Map<WaTemplateCategory, WaTemplateDef[]>();
    WA_TEMPLATES.forEach((t) => {
      const arr = m.get(t.category) ?? [];
      arr.push(t); m.set(t.category, arr);
    });
    return m;
  }, []);

  const update = (key: string, patch: Partial<{ body: string; autoSend: boolean }>) =>
    setValues((prev) => ({ ...prev, [key]: { ...prev[key]!, ...patch } }));

  const insertToken = (key: string, token: string) => {
    const ta = refs.current[key];
    const current = values[key]?.body ?? "";
    const insert = `[${token}]`;
    if (!ta) { update(key, { body: current + insert }); return; }
    const start = ta.selectionStart ?? current.length;
    const end = ta.selectionEnd ?? current.length;
    const next = current.slice(0, start) + insert + current.slice(end);
    update(key, { body: next });
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + insert.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("companies")
      .update({ wa_templates: values as any }).eq("id", companyId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("WhatsApp templates saved");
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const previewTpl = previewKey ? WA_TEMPLATES.find((t) => t.key === previewKey) : null;
  const previewBody = previewKey ? values[previewKey]?.body ?? "" : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save all templates"}</Button>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const list = grouped.get(cat) ?? [];
        if (list.length === 0) return null;
        return (
          <section key={cat} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              ► {CATEGORY_LABELS[cat]}
            </h3>
            <div className="space-y-4">
              {list.map((t) => {
                const v = values[t.key];
                if (!v) return null;
                return (
                  <div key={t.key} className="border rounded-md p-4 space-y-3 bg-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm">{t.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{t.fires}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Label htmlFor={`auto-${t.key}`} className="text-xs">Auto-send</Label>
                        <Switch
                          id={`auto-${t.key}`}
                          checked={v.autoSend}
                          onCheckedChange={(c) => update(t.key, { autoSend: c })}
                        />
                      </div>
                    </div>

                    <Textarea
                      ref={(el) => { refs.current[t.key] = el; }}
                      value={v.body}
                      onChange={(e) => update(t.key, { body: e.target.value })}
                      rows={4}
                      className="font-mono text-sm"
                    />

                    <div className="flex flex-wrap gap-1.5">
                      {PLACEHOLDERS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => insertToken(t.key, p)}
                          className="text-[11px] rounded-full border bg-background px-2 py-0.5 hover:bg-accent transition-colors"
                        >
                          [{p}]
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={v.autoSend ? "default" : "secondary"} className="text-[10px]">
                        {v.autoSend ? "Auto-sends" : "Preview first"}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => setPreviewKey(t.key)}>
                        Preview
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="flex items-center justify-end pt-2">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save all templates"}</Button>
      </div>

      <Dialog open={!!previewKey} onOpenChange={(o) => !o && setPreviewKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{previewTpl?.name}</DialogTitle>
            <DialogDescription>Preview with sample data filled in.</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
            {renderPreview(previewBody)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
