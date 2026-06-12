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

import { Checkbox } from "@/components/ui/checkbox";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAutosaveDraft, loadDraft } from "@/hooks/use-autosave-draft";
import { formatINR, formatTimeOfDay, addHoursToTime } from "@/lib/format";
import { Loader2, Info, Sparkles, Trash2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { TimeClockField } from "@/components/ui/time-clock-picker";
import { DateConfirmField } from "@/components/ui/date-confirm-field";

type Requirement = Database["public"]["Tables"]["requirements"]["Row"];
type AddOn = Database["public"]["Tables"]["add_ons_selected"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  companyId: string;
  requirementId?: string | null;
  onSaved?: () => void;
  onSavedAndQuote?: (requirementId: string) => void;
}

type Session = { name: string; start_time: string; end_time: string };
type EventType = { label?: string; name?: string };
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

export function RequirementSheet({ open, onOpenChange, leadId, companyId, requirementId, onSaved, onSavedAndQuote }: Props) {
  const isMobile = useIsMobile();
  const { profile } = useAuth();
  const draftKey = `req:${leadId}:${requirementId ?? "new"}`;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [isMandapam, setIsMandapam] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [communities, setCommunities] = useState<{ label?: string; name?: string }[]>([]);
  const [communityOther, setCommunityOther] = useState("");
  const [addonsCatalog, setAddonsCatalog] = useState<AddonCat[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<{ addon_name: string; addon_price: number; is_custom: boolean }[]>([]);
  const [customAddon, setCustomAddon] = useState({ name: "", price: "" });
  const [loading, setLoading] = useState(true);
  const [otherCount, setOtherCount] = useState<number | null>(null);
  const [countingOthers, setCountingOthers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentReqId, setCurrentReqId] = useState<string | null>(requirementId ?? null);
  const [leadEmail, setLeadEmail] = useState("");

  useAutosaveDraft(draftKey, { form, isMandapam, selectedAddons }, open && !requirementId);

  // Load company settings + existing requirement
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const [{ data: co }, { data: leadRow }] = await Promise.all([
        supabase
          .from("companies")
          .select("is_mandapam, sessions, event_types, addons_catalog, communities")
          .eq("id", companyId)
          .maybeSingle(),
        supabase.from("leads").select("email").eq("id", leadId).maybeSingle(),
      ]);
      setLeadEmail(((leadRow as any)?.email ?? "") as string);
      const c: any = co ?? {};
      setIsMandapam(!!c.is_mandapam);
      setSessions(Array.isArray(c.sessions) ? c.sessions : []);
      setEventTypes(Array.isArray(c.event_types) ? c.event_types : []);
      setCommunities(Array.isArray(c.communities) ? c.communities : []);
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
    if (name === "__none") {
      setForm((f) => ({ ...f, session_name: "", start_time: "", end_time: "" }));
      return;
    }
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
    const trimmedEmail = leadEmail.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Enter a valid email address");
      return null;
    }
    await supabase.from("leads").update({ email: trimmedEmail || null }).eq("id", leadId);
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
      community: (form.community === "Other" ? communityOther.trim() : form.community) || null,
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

  const onSaveAndQuote = async () => {
    setSaving(true);
    const id = await ensureRequirementSaved();
    setSaving(false);
    if (id) {
      toast.success("Requirement saved");
      onSaved?.();
      onOpenChange(false);
      onSavedAndQuote?.(id);
    }
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
              <DateConfirmField value={form.event_date} onChange={(v) => setForm({ ...form, event_date: v })} disabled={(d) => d < new Date(new Date().toDateString())} />
              <DateInfoBanner count={otherCount} loading={countingOthers} hasDate={!!form.event_date} />
            </div>

            {/* Session picker (when sessions configured) + manual start/duration */}
            {sessions.length > 0 && (
              <div className="space-y-1.5">
                <Label>Session {isMandapam ? "*" : "(optional)"}</Label>
                <Select value={form.session_name} onValueChange={onSessionChange}>
                  <SelectTrigger><SelectValue placeholder="Pick a session" /></SelectTrigger>
                  <SelectContent>
                    {!isMandapam && <SelectItem value="__none">— Enter time manually —</SelectItem>}
                    {sessions.map((s) => (
                      <SelectItem key={s.name} value={s.name}>
                        {s.name} · {formatTimeOfDay(s.start_time)} – {formatTimeOfDay(s.end_time)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Manual time entry — always shown for non-mandapam, or when no session selected */}
            {(!isMandapam || !form.session_name) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start time {!sessions.length ? "*" : "(optional)"}</Label>
                  <TimeClockField value={form.start_time} onChange={onStartChange} />
                </div>
                <div className="space-y-1.5">
                  <Label>Duration</Label>
                  <DurationSelect value={form.duration_hours} onChange={onDurationChange} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Ends at</Label>
                  <div className="h-10 px-3 flex items-center text-sm border rounded-md bg-muted/30">
                    {form.end_time ? formatTimeOfDay(form.end_time) : "—"}
                  </div>
                </div>
              </div>
            )}

            {/* Muhurtham */}
            <div className="space-y-1.5">
              <Label>Muhurtham time (optional)</Label>
              <TimeClockField value={form.muhurtham_time} onChange={(v) => setForm({ ...form, muhurtham_time: v })} />
              <p className="text-[11px] text-muted-foreground">For your reference — slot is locked only when payment confirms the booking.</p>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="req-email">Email <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="req-email"
                type="email"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>




            {/* Event type */}
            <div className="space-y-1.5">
              <Label>Event type *</Label>
              <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                <SelectTrigger><SelectValue placeholder="Choose event type" /></SelectTrigger>
                <SelectContent>
                  {eventTypes.map((t) => {
                    const v = (t.label ?? t.name ?? "").trim();
                    if (!v) return null;
                    return <SelectItem key={v} value={v}>{v}</SelectItem>;
                  })}
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
                {(() => {
                  const list = communities
                    .map((t) => (t.label ?? t.name ?? "").trim())
                    .filter(Boolean);
                  const isOther = !!form.community && form.community === "Other";
                  const selectVal = !form.community
                    ? ""
                    : list.includes(form.community)
                      ? form.community
                      : (form.community === "Other" ? "Other" : "Other");
                  // If existing value is not in list and not empty, treat as Other and seed text
                  if (form.community && !list.includes(form.community) && form.community !== "Other" && communityOther === "") {
                    // seed once
                    setTimeout(() => setCommunityOther(form.community), 0);
                    setTimeout(() => setForm((f) => ({ ...f, community: "Other" })), 0);
                  }
                  return (
                    <>
                      <Select
                        value={selectVal}
                        onValueChange={(v) => {
                          if (v === "Other") setForm({ ...form, community: "Other" });
                          else setForm({ ...form, community: v });
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Pick community" /></SelectTrigger>
                        <SelectContent>
                          {list.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      {(form.community === "Other" || isOther) && (
                        <Input
                          placeholder="Describe the community"
                          value={communityOther}
                          onChange={(e) => setCommunityOther(e.target.value)}
                        />
                      )}
                    </>
                  );
                })()}
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
          <div className="flex gap-2">
            <Button onClick={onSaveOnly} disabled={saving || loading} variant={onSavedAndQuote ? "outline" : "default"}>
              {saving ? "Saving…" : currentReqId ? "Save changes" : "Save requirement"}
            </Button>
            {onSavedAndQuote && (
              <Button onClick={onSaveAndQuote} disabled={saving || loading}>
                {saving ? "Saving…" : "Save & Open Quotation"}
              </Button>
            )}
          </div>
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

function DateInfoBanner({ count, loading, hasDate }: { count: number | null; loading: boolean; hasDate: boolean }) {
  if (!hasDate) return null;
  if (loading || count === null) {
    return (
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground inline-flex items-center gap-2">
        <Info className="h-3.5 w-3.5" /> Checking other enquiries for this date…
      </div>
    );
  }
  if (count === 0) {
    return (
      <div className="rounded-md border border-success/30 bg-success/10 text-success dark:text-success px-3 py-2 text-xs inline-flex items-center gap-2">
        <Info className="h-3.5 w-3.5" /> No other enquiries — this date is free.
      </div>
    );
  }
  return (
    <div className="rounded-md border border-warning/30 bg-warning/10 text-warning dark:text-warning px-3 py-2 text-xs inline-flex items-center gap-2">
      <Info className="h-3.5 w-3.5" />
      {count} other {count === 1 ? "enquiry" : "enquiries"} on this date. First to pay locks the slot.
    </div>
  );
}

function DurationSelect({ value, onChange }: { value: number; onChange: (h: number) => void }) {
  const presets = [2, 3, 4, 5, 6, 8];
  const isPreset = presets.includes(value);
  const [custom, setCustom] = useState(!isPreset);
  return (
    <div className="space-y-1">
      <select
        className="h-10 w-full rounded-md border bg-background px-2 text-sm"
        value={custom ? "custom" : String(value)}
        onChange={(e) => {
          if (e.target.value === "custom") setCustom(true);
          else { setCustom(false); onChange(Number(e.target.value)); }
        }}
      >
        {presets.map((p) => <option key={p} value={p}>{p} hours</option>)}
        <option value="custom">Custom…</option>
      </select>
      {custom && (
        <Input type="number" min={0.5} max={24} step={0.5} value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)} placeholder="Hours" />
      )}
    </div>
  );
}


