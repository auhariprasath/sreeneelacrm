import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAutosaveDraft, loadDraft } from "@/hooks/use-autosave-draft";
import { formatINR, formatTimeOfDay, addHoursToTime } from "@/lib/format";
import { Loader2, Info, Sparkles, Trash2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Requirement = Database["public"]["Tables"]["requirements"]["Row"];
type AddOn = Database["public"]["Tables"]["add_ons_selected"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  companyId: string;
  requirementId?: string | null;
  onSaved?: () => void;
}

type Session = { name: string; start_time: string; end_time: string };
type EventType = { name: string };
type AddonCat = { name: string; price: number };

type FormState = {
  event_date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  session_name: string; // mandapam only
  event_type: string;
  event_type_other: string;
  guest_count: string;
  budget_range: string;
  muhurtham_time: string;
  community: string;
  notes: string;
};

const EMPTY: FormState = {
  event_date: "",
  start_time: "",
  end_time: "",
  duration_hours: 4,
  session_name: "",
  event_type: "",
  event_type_other: "",
  guest_count: "",
  budget_range: "",
  muhurtham_time: "",
  community: "",
  notes: "",
};

const BUDGETS = ["Under ₹1L", "₹1L - ₹3L", "₹3L - ₹5L", "₹5L - ₹10L", "₹10L - ₹25L", "₹25L+"];

export function RequirementSheet({ open, onOpenChange, leadId, companyId, requirementId, onSaved }: Props) {
  const isMobile = useIsMobile();
  const { profile } = useAuth();
  const draftKey = `req:${leadId}:${requirementId ?? "new"}`;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [isMandapam, setIsMandapam] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [addonsCatalog, setAddonsCatalog] = useState<AddonCat[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<{ addon_name: string; addon_price: number; is_custom: boolean }[]>([]);
  const [customAddon, setCustomAddon] = useState({ name: "", price: "" });
  const [loading, setLoading] = useState(true);
  const [otherCount, setOtherCount] = useState<number | null>(null);
  const [countingOthers, setCountingOthers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentReqId, setCurrentReqId] = useState<string | null>(requirementId ?? null);

  useAutosaveDraft(draftKey, { form, isMandapam, selectedAddons }, open && !requirementId);

  // Load company settings + existing requirement
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const { data: co } = await supabase
        .from("companies")
        .select("is_mandapam, sessions, event_types, addons_catalog")
        .eq("id", companyId)
        .maybeSingle();
      const c: any = co ?? {};
      setIsMandapam(!!c.is_mandapam);
      setSessions(Array.isArray(c.sessions) ? c.sessions : []);
      setEventTypes(Array.isArray(c.event_types) ? c.event_types : []);
      setAddonsCatalog(Array.isArray(c.addons_catalog) ? c.addons_catalog : []);

      if (requirementId) {
        const [{ data: r }, { data: ads }] = await Promise.all([
          supabase.from("requirements").select("*").eq("id", requirementId).maybeSingle(),
          supabase.from("add_ons_selected").select("*").eq("requirement_id", requirementId),
        ]);
        if (r) {
          const req = r as Requirement;
          setForm({
            event_date: req.event_date ?? "",
            start_time: req.start_time?.slice(0, 5) ?? "",
            end_time: req.end_time?.slice(0, 5) ?? "",
            duration_hours: Number(req.duration_hours ?? 4),
            session_name: "",
            event_type: req.event_type ?? "",
            event_type_other: req.event_type_other ?? "",
            guest_count: req.guest_count ? String(req.guest_count) : "",
            budget_range: req.budget_range ?? "",
            muhurtham_time: req.muhurtham_time?.slice(0, 5) ?? "",
            community: req.community ?? "",
            notes: req.notes ?? "",
          });
          setSelectedAddons(((ads as AddOn[]) ?? []).map((a) => ({
            addon_name: a.addon_name, addon_price: Number(a.addon_price), is_custom: a.is_custom,
          })));
          setCurrentReqId(requirementId);
        }
      } else {
        const draft = loadDraft<{ form: FormState; isMandapam: boolean; selectedAddons: any[] }>(draftKey);
        if (draft?.form) {
          setForm(draft.form);
          setSelectedAddons(draft.selectedAddons ?? []);
        } else {
          setForm(EMPTY);
          setSelectedAddons([]);
        }
        setCurrentReqId(null);
      }
      setOtherCount(null);
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, [open, requirementId, companyId]);

  // Pick session → auto-fill start/end
  const onSessionChange = (name: string) => {
    const s = sessions.find((x) => x.name === name);
    if (!s) return;
    setForm((f) => ({
      ...f,
      session_name: name,
      start_time: s.start_time,
      end_time: s.end_time,
      duration_hours: diffHours(s.start_time, s.end_time),
    }));
  };

  // Duration → auto-fill end
  const onDurationChange = (h: number) => {
    setForm((f) => ({ ...f, duration_hours: h, end_time: f.start_time ? addHoursToTime(f.start_time, h) : f.end_time }));
  };
  const onStartChange = (t: string) => {
    setForm((f) => ({ ...f, start_time: t, end_time: f.duration_hours ? addHoursToTime(t, f.duration_hours) : f.end_time }));
  };

  // Count other active enquiries on the same date (+ session for mandapam).
  // "Active" = requirement not soft-deleted AND lead not lost/dropped.
  useEffect(() => {
    if (!open) return;
    if (!form.event_date) { setOtherCount(null); return; }
    if (isMandapam && !form.session_name) { setOtherCount(null); return; }
    let cancelled = false;
    setCountingOthers(true);
    (async () => {
      let q = supabase
        .from("requirements")
        .select("id, lead_id, leads!inner(status)", { count: "exact", head: false })
        .eq("company_id", companyId)
        .eq("event_date", form.event_date)
        .is("deleted_at", null)
        .neq("leads.status", "negative");
      if (isMandapam && form.session_name) {
        // For mandapam venues, session defines the slot
        q = q.eq("start_time", form.start_time);
      }
      if (currentReqId) q = q.neq("id", currentReqId);
      const { data, error } = await q;
      if (cancelled) return;
      setCountingOthers(false);
      if (error) { setOtherCount(null); return; }
      setOtherCount((data ?? []).length);
    })();
    return () => { cancelled = true; };
  }, [open, companyId, form.event_date, form.session_name, form.start_time, isMandapam, currentReqId]);


  const ensureRequirementSaved = async (): Promise<string | null> => {
    if (currentReqId) {
      await persistRequirement(currentReqId);
      return currentReqId;
    }
    return await persistRequirement(null);
  };

  const persistRequirement = async (existingId: string | null): Promise<string | null> => {
    if (!form.event_date || !form.event_type) {
      toast.error("Event date and event type are required");
      return null;
    }
    const payload: any = {
      lead_id: leadId,
      company_id: companyId,
      event_date: form.event_date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      duration_hours: form.duration_hours || null,
      event_type: form.event_type,
      event_type_other: form.event_type === "Other" ? form.event_type_other : null,
      guest_count: form.guest_count ? Number(form.guest_count) : null,
      budget_range: form.budget_range || null,
      muhurtham_time: form.muhurtham_time || null,
      community: form.community || null,
      notes: form.notes || null,
      created_by: profile?.id ?? null,
    };
    if (existingId) {
      const { error } = await supabase.from("requirements").update(payload).eq("id", existingId);
      if (error) { toast.error(error.message); return null; }
      await syncAddons(existingId);
      return existingId;
    }
    // Get next requirement_number for this lead
    const { count } = await supabase.from("requirements").select("id", { head: true, count: "exact" }).eq("lead_id", leadId).is("deleted_at", null);
    const { data, error } = await supabase
      .from("requirements")
      .insert({ ...payload, requirement_number: (count ?? 0) + 1, status: "collecting" })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return null; }
    const id = (data as any).id as string;
    await syncAddons(id);
    setCurrentReqId(id);
    return id;
  };

  const syncAddons = async (reqId: string) => {
    await supabase.from("add_ons_selected").delete().eq("requirement_id", reqId);
    if (selectedAddons.length === 0) return;
    await supabase.from("add_ons_selected").insert(
      selectedAddons.map((a) => ({ requirement_id: reqId, ...a })),
    );
  };

  const onSaveOnly = async () => {
    setSaving(true);
    const id = await ensureRequirementSaved();
    setSaving(false);
    if (id) {
      toast.success("Requirement saved");
      onSaved?.();
    }
  };

  const onSoftHold = async () => {
    if (!slotCheck || slotCheck.status !== "free") {
      toast.error("Run a slot check first — only free slots can be held");
      return;
    }
    setSaving(true);
    const id = await ensureRequirementSaved();
    if (!id) { setSaving(false); return; }
    try {
      const slot = await createSoftHold({
        companyId, leadId, requirementId: id,
        eventDate: form.event_date,
        startTime: form.start_time,
        endTime: form.end_time,
        sessionName: isMandapam ? form.session_name : null,
      });
      await supabase.from("requirements").update({ status: "slot_checking" }).eq("id", id);
      await supabase.from("activity_logs").insert({
        lead_id: leadId, action: "Soft hold placed (30 min)",
        action_type: "system", performed_by: profile?.id ?? null,
        note: `${form.event_date} ${formatTimeOfDay(form.start_time)} - ${formatTimeOfDay(form.end_time)}`,
      });
      setHeldUntil(slot.held_until);
      toast.success("Soft hold placed for 30 minutes");
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't place hold");
    } finally {
      setSaving(false);
    }
  };

  const onReleaseHold = async () => {
    if (!currentReqId) return;
    await releaseSoftHold(currentReqId);
    await supabase.from("requirements").update({ status: "collecting" }).eq("id", currentReqId);
    setHeldUntil(null);
    setSlotCheck(null);
    toast.success("Hold released");
    onSaved?.();
  };

  const totalAddons = useMemo(() => selectedAddons.reduce((s, a) => s + Number(a.addon_price || 0), 0), [selectedAddons]);

  const toggleCatalogAddon = (a: AddonCat, on: boolean) => {
    setSelectedAddons((prev) => on
      ? [...prev, { addon_name: a.name, addon_price: Number(a.price) || 0, is_custom: false }]
      : prev.filter((x) => !(x.addon_name === a.name && !x.is_custom)));
  };
  const addCustomAddon = () => {
    if (!customAddon.name.trim()) return;
    setSelectedAddons((p) => [...p, { addon_name: customAddon.name.trim(), addon_price: Number(customAddon.price) || 0, is_custom: true }]);
    setCustomAddon({ name: "", price: "" });
  };

  const side = isMobile ? "bottom" : "right";
  const sheetClass = isMobile
    ? "h-[92vh] w-full p-0 flex flex-col rounded-t-xl"
    : "w-full sm:max-w-xl p-0 flex flex-col";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className={sheetClass}>
        <SheetHeader className="px-5 pt-5 pb-2 border-b shrink-0">
          <SheetTitle>{currentReqId ? "Edit requirement" : "Capture requirement"}</SheetTitle>
          <SheetDescription>Event details, slot check & add-ons</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Event date */}
            <div className="space-y-1.5">
              <Label>Event date *</Label>
              <Input type="date" value={form.event_date} onChange={(e) => { setForm({ ...form, event_date: e.target.value }); setSlotCheck(null); }} />
            </div>

            {/* Mandapam: session picker / non-mandapam: start + duration */}
            {isMandapam && sessions.length > 0 ? (
              <div className="space-y-1.5">
                <Label>Session *</Label>
                <Select value={form.session_name} onValueChange={onSessionChange}>
                  <SelectTrigger><SelectValue placeholder="Pick a session" /></SelectTrigger>
                  <SelectContent>
                    {sessions.map((s) => (
                      <SelectItem key={s.name} value={s.name}>
                        {s.name} · {formatTimeOfDay(s.start_time)} - {formatTimeOfDay(s.end_time)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start time *</Label>
                  <Input type="time" value={form.start_time} onChange={(e) => onStartChange(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Duration (hours)</Label>
                  <Input type="number" min={1} max={24} step={0.5} value={form.duration_hours}
                    onChange={(e) => onDurationChange(Number(e.target.value) || 0)} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>End time</Label>
                  <Input type="time" value={form.end_time} onChange={(e) => { setForm({ ...form, end_time: e.target.value }); setSlotCheck(null); }} />
                </div>
              </div>
            )}

            {/* Slot check panel */}
            <SlotPanel
              check={slotCheck}
              checking={checking}
              canCheck={canCheckSlot}
              onCheck={runSlotCheck}
              heldUntilLabel={heldUntil ? countdown.label : null}
              expired={heldUntil ? countdown.expired : false}
              onSoftHold={onSoftHold}
              onRelease={onReleaseHold}
              saving={saving}
              hasHold={!!heldUntil && !countdown.expired}
            />

            {/* Muhurtham */}
            <div className="space-y-1.5">
              <Label>Muhurtham time (optional)</Label>
              <Input type="time" value={form.muhurtham_time} onChange={(e) => { setForm({ ...form, muhurtham_time: e.target.value }); setSlotCheck(null); }} />
              <p className="text-[11px] text-muted-foreground">If set, we check whether it clashes with another confirmed booking.</p>
            </div>

            {/* Event type */}
            <div className="space-y-1.5">
              <Label>Event type *</Label>
              <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                <SelectTrigger><SelectValue placeholder="Choose event type" /></SelectTrigger>
                <SelectContent>
                  {eventTypes.map((t) => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              {form.event_type === "Other" && (
                <Input placeholder="Describe the event" value={form.event_type_other}
                  onChange={(e) => setForm({ ...form, event_type_other: e.target.value })} />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Guest count</Label>
                <Input type="number" min={0} value={form.guest_count} onChange={(e) => setForm({ ...form, guest_count: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Community (optional)</Label>
                <Input value={form.community} onChange={(e) => setForm({ ...form, community: e.target.value })} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Budget range</Label>
              <Select value={form.budget_range} onValueChange={(v) => setForm({ ...form, budget_range: v })}>
                <SelectTrigger><SelectValue placeholder="Pick budget range" /></SelectTrigger>
                <SelectContent>
                  {BUDGETS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Add-ons */}
            <div className="space-y-2">
              <Label>Add-ons</Label>
              {addonsCatalog.length > 0 && (
                <div className="border rounded-md divide-y">
                  {addonsCatalog.map((a) => {
                    const on = selectedAddons.some((x) => x.addon_name === a.name && !x.is_custom);
                    return (
                      <label key={a.name} className="flex items-center gap-3 p-2.5 cursor-pointer">
                        <Checkbox checked={on} onCheckedChange={(c) => toggleCatalogAddon(a, !!c)} />
                        <div className="flex-1 text-sm">{a.name}</div>
                        <div className="text-sm text-muted-foreground">{formatINR(Number(a.price), { short: true })}</div>
                      </label>
                    );
                  })}
                </div>
              )}
              {selectedAddons.filter((a) => a.is_custom).length > 0 && (
                <div className="border rounded-md divide-y">
                  {selectedAddons.filter((a) => a.is_custom).map((a, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5">
                      <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="flex-1 text-sm">{a.addon_name}</div>
                      <div className="text-sm text-muted-foreground">{formatINR(a.addon_price, { short: true })}</div>
                      <Button size="icon" variant="ghost" onClick={() => setSelectedAddons((p) => p.filter((x) => x !== a))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input placeholder="Custom add-on name" value={customAddon.name} onChange={(e) => setCustomAddon({ ...customAddon, name: e.target.value })} />
                <Input placeholder="₹ price" type="number" className="w-28" value={customAddon.price} onChange={(e) => setCustomAddon({ ...customAddon, price: e.target.value })} />
                <Button variant="outline" onClick={addCustomAddon}>Add</Button>
              </div>
              {selectedAddons.length > 0 && (
                <div className="text-xs text-muted-foreground text-right">Add-ons total: <span className="font-medium text-foreground">{formatINR(totalAddons, { short: true })}</span></div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything else worth noting" />
            </div>
          </div>
        )}

        <div className="border-t p-4 flex items-center justify-between gap-2 shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={onSaveOnly} disabled={saving || loading}>
            {saving ? "Saving…" : currentReqId ? "Save changes" : "Save requirement"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function diffHours(a: string, b: string) {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  const mins = ((bh || 0) * 60 + (bm || 0)) - ((ah || 0) * 60 + (am || 0));
  return Math.max(0.5, mins / 60);
}

function SlotPanel({
  check, checking, canCheck, onCheck, heldUntilLabel, expired, onSoftHold, onRelease, saving, hasHold,
}: {
  check: SlotCheck | null;
  checking: boolean;
  canCheck: boolean;
  onCheck: () => void;
  heldUntilLabel: string | null;
  expired: boolean;
  onSoftHold: () => void;
  onRelease: () => void;
  saving: boolean;
  hasHold: boolean;
}) {
  const status = check?.status;
  const tone =
    status === "free" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
    : status === "soft_hold" ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200"
    : status === "enquiry" ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200"
    : status === "confirmed" ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
    : status === "muhurtham_conflict" ? "bg-purple-500/10 border-purple-500/30 text-purple-800 dark:text-purple-200"
    : "bg-muted border-border text-muted-foreground";

  const Icon =
    status === "free" ? CheckCircle2
    : status === "confirmed" ? XCircle
    : status === "muhurtham_conflict" ? AlertTriangle
    : status ? AlertTriangle
    : Clock;

  return (
    <div className={`rounded-lg border p-3 ${tone}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4" />
          {!status && "Check slot availability"}
          {status === "free" && "Slot available"}
          {status === "soft_hold" && "Slot is on a soft hold by someone else"}
          {status === "enquiry" && "Slot has an active enquiry"}
          {status === "confirmed" && "Slot already booked"}
          {status === "muhurtham_conflict" && "Muhurtham time clashes with another confirmed booking"}
        </div>
        <Button size="sm" variant="outline" onClick={onCheck} disabled={!canCheck || checking}>
          {checking ? "Checking…" : status ? "Re-check" : "Check slot"}
        </Button>
      </div>

      {hasHold && (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Soft hold: {heldUntilLabel} remaining</span>
          <Button size="sm" variant="ghost" onClick={onRelease} disabled={saving}>Release</Button>
        </div>
      )}
      {!hasHold && expired && (
        <div className="mt-2 text-xs">Soft hold expired — slot is free again.</div>
      )}
      {status === "free" && !hasHold && (
        <div className="mt-2">
          <Button size="sm" onClick={onSoftHold} disabled={saving}>
            {saving ? "Placing hold…" : "Place 30-min soft hold"}
          </Button>
        </div>
      )}
      {check?.conflicts && check.conflicts.length > 0 && (
        <div className="mt-2 text-xs space-y-0.5">
          {check.conflicts.map((c) => (
            <div key={c.id}>
              <Badge variant="secondary" className="mr-1 capitalize">{c.status.replace("_", " ")}</Badge>
              {formatTimeOfDay(c.start_time)} – {formatTimeOfDay(c.end_time)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
