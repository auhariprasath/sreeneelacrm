import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Sparkles, History, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatINR, formatDateIN, formatDateTimeIN, formatTimeOfDay } from "@/lib/format";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Requirement = Database["public"]["Tables"]["requirements"]["Row"];
type Quotation = Database["public"]["Tables"]["quotations"]["Row"];

interface LineItem { name: string; price: number; quantity: number }
interface AddonItem { name: string; price: number }

interface ServiceCatalogItem { name: string; price?: number }
interface AddonCatalogItem { name: string; price?: number }
interface PeakRange { start: string; end: string; label?: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  companyId: string;
  requirementId: string | null;
  /** If editing/revising an existing quotation, pass its id. New version is created on send. */
  quotationId?: string | null;
  onSaved?: () => void;
  onContinueToSend?: (quotationId: string) => void;
}

const CUSTOM = "__custom__";

export function QuotationBuilder({ open, onOpenChange, leadId, companyId, requirementId, quotationId, onSaved, onContinueToSend }: Props) {
  const { role, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requirement, setRequirement] = useState<Requirement | null>(null);

  const [servicesCatalog, setServicesCatalog] = useState<ServiceCatalogItem[]>([]);
  const [addonsCatalog, setAddonsCatalog] = useState<AddonCatalogItem[]>([]);
  const [gstPercentDefault, setGstPercentDefault] = useState(18);
  const [staffMax, setStaffMax] = useState(5);
  const [adminMax, setAdminMax] = useState(15);
  const [requireReason, setRequireReason] = useState(true);
  const [peakLabel, setPeakLabel] = useState<string | null>(null);

  const [services, setServices] = useState<LineItem[]>([]);
  const [addons, setAddons] = useState<AddonItem[]>([]);
  const [discountMode, setDiscountMode] = useState<"percent" | "amount">("percent");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [gstApplied, setGstApplied] = useState(true);
  const [gstPercent, setGstPercent] = useState(18);

  const [draftId, setDraftId] = useState<string | null>(quotationId ?? null);
  const [baseVersion, setBaseVersion] = useState(1);
  const [history, setHistory] = useState<Quotation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load everything when opened
  useEffect(() => {
    if (!open || !requirementId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: req }, { data: comp }, { data: addOnsRows }, { data: prior }] = await Promise.all([
        supabase.from("requirements").select("*").eq("id", requirementId).maybeSingle(),
        supabase.from("companies").select("services_catalog,addons_catalog,gst_percent,staff_max_discount_percent,admin_max_discount_percent,require_discount_reason,peak_season_dates").eq("id", companyId).maybeSingle(),
        supabase.from("add_ons_selected").select("addon_name,addon_price").eq("requirement_id", requirementId),
        supabase.from("quotations").select("*").eq("lead_id", leadId).is("deleted_at", null).order("version", { ascending: false }),
      ]);
      if (cancelled) return;
      if (!req) { toast.error("Requirement not found"); onOpenChange(false); return; }
      setRequirement(req as Requirement);

      const c = comp as any;
      setServicesCatalog(Array.isArray(c?.services_catalog) ? c.services_catalog : []);
      setAddonsCatalog(Array.isArray(c?.addons_catalog) ? c.addons_catalog : []);
      const gp = Number(c?.gst_percent ?? 18); setGstPercentDefault(gp); setGstPercent(gp);
      setStaffMax(Number(c?.staff_max_discount_percent ?? 5));
      setAdminMax(Number(c?.admin_max_discount_percent ?? 15));
      setRequireReason(Boolean(c?.require_discount_reason ?? true));

      // peak detection
      const ranges: PeakRange[] = Array.isArray(c?.peak_season_dates) ? c.peak_season_dates : [];
      if ((req as Requirement).event_date) {
        const ed = (req as Requirement).event_date as string;
        const hit = ranges.find((r) => r.start && r.end && ed >= r.start && ed <= r.end);
        setPeakLabel(hit ? (hit.label || "Peak season") : null);
      } else setPeakLabel(null);

      const allHistory = (prior as Quotation[]) ?? [];
      setHistory(allHistory);

      // If editing an explicit quotationId, load it as the working draft (new version on send)
      const base = quotationId ? allHistory.find((q) => q.id === quotationId) : allHistory.find((q) => q.status === "draft");
      if (base) {
        setDraftId(base.id);
        setBaseVersion(base.version);
        setServices(((base.services as any) ?? []) as LineItem[]);
        setAddons(((base.addons as any) ?? []) as AddonItem[]);
        const dp = Number(base.discount_percent || 0); const da = Number(base.discount_amount || 0);
        if (dp > 0 && da === 0) { setDiscountMode("percent"); setDiscountPercent(dp); }
        else if (da > 0) { setDiscountMode("amount"); setDiscountAmount(da); }
        setDiscountReason(base.discount_reason ?? "");
        setGstApplied(base.gst_applied ?? true);
        setGstPercent(Number(base.gst_percent ?? gp));
      } else {
        // pre-fill addons from requirement
        setAddons(((addOnsRows as any[]) ?? []).map((a) => ({ name: a.addon_name, price: Number(a.addon_price) || 0 })));
        setServices([{ name: "", price: 0, quantity: 1 }]);
        setBaseVersion((allHistory[0]?.version ?? 0) + 1);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requirementId, companyId, leadId, quotationId]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setDraftId(null); setRequirement(null);
      setServices([]); setAddons([]); setDiscountPercent(0); setDiscountAmount(0); setDiscountReason("");
      setGstApplied(true); setLastSaved(null); setShowHistory(false);
    }
  }, [open]);

  // Totals
  const subtotal = useMemo(() => {
    const s = services.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
    const a = addons.reduce((sum, it) => sum + (Number(it.price) || 0), 0);
    return s + a;
  }, [services, addons]);

  const effDiscountAmount = useMemo(() => {
    if (discountMode === "percent") return Math.round((subtotal * (Number(discountPercent) || 0)) / 100);
    return Math.min(Number(discountAmount) || 0, subtotal);
  }, [discountMode, discountPercent, discountAmount, subtotal]);

  const effDiscountPercent = useMemo(() => {
    if (subtotal <= 0) return 0;
    return discountMode === "percent" ? (Number(discountPercent) || 0) : ((effDiscountAmount / subtotal) * 100);
  }, [discountMode, discountPercent, effDiscountAmount, subtotal]);

  const afterDiscount = Math.max(0, subtotal - effDiscountAmount);
  const gstAmount = gstApplied ? Math.round((afterDiscount * (Number(gstPercent) || 0)) / 100) : 0;
  const total = afterDiscount + gstAmount;

  const myMax = role === "super_admin" ? Infinity : role === "admin" ? adminMax : staffMax;
  const discountOverLimit = effDiscountPercent > myMax + 0.0001;
  const reasonMissing = effDiscountAmount > 0 && requireReason && !discountReason.trim();
  const canSubmit = !discountOverLimit && !reasonMissing && services.some((s) => s.name.trim() && (Number(s.price) || 0) > 0 && (Number(s.quantity) || 0) > 0);

  // Auto-save every 30s
  const autoSaveRef = useRef<number | null>(null);
  useEffect(() => {
    if (!open || loading || !requirement) return;
    if (autoSaveRef.current) window.clearInterval(autoSaveRef.current);
    autoSaveRef.current = window.setInterval(() => { saveDraft(true).catch(() => {}); }, 30_000);
    return () => { if (autoSaveRef.current) window.clearInterval(autoSaveRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading, requirement, services, addons, discountMode, discountPercent, discountAmount, discountReason, gstApplied, gstPercent]);

  const saveDraft = async (silent = false): Promise<string | null> => {
    if (!requirement) return null;
    setSaving(true);
    const payload = {
      lead_id: leadId,
      requirement_id: requirement.id,
      company_id: companyId,
      version: baseVersion,
      services: services as any,
      addons: addons as any,
      subtotal,
      discount_percent: Number(effDiscountPercent.toFixed(2)),
      discount_amount: effDiscountAmount,
      discount_reason: discountReason || null,
      gst_applied: gstApplied,
      gst_percent: gstPercent,
      gst_amount: gstAmount,
      total,
      is_peak_season: !!peakLabel,
      peak_season_label: peakLabel,
      status: "draft" as const,
      created_by: profile?.id ?? null,
    };

    let id = draftId;
    if (id) {
      const { error } = await supabase.from("quotations").update(payload).eq("id", id);
      if (error) { setSaving(false); if (!silent) toast.error(error.message); return null; }
    } else {
      const { data, error } = await supabase.from("quotations").insert(payload).select("id").single();
      if (error || !data) { setSaving(false); if (!silent) toast.error(error?.message || "Couldn't save draft"); return null; }
      id = data.id; setDraftId(id);
    }
    setSaving(false);
    setLastSaved(new Date());
    if (!silent) toast.success("Draft saved");
    onSaved?.();
    return id;
  };

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>Quotation Builder {baseVersion > 1 && <span className="text-xs font-normal text-muted-foreground">· v{baseVersion}</span>}</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !requirement ? null : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Read-only event summary */}
            <div className="bg-muted/40 border rounded-md p-3 text-sm space-y-1">
              <div className="font-medium">{requirement.event_type || "Event"}{requirement.event_type_other ? ` — ${requirement.event_type_other}` : ""}</div>
              <div className="text-muted-foreground text-xs">
                {requirement.event_date ? formatDateIN(requirement.event_date) : "Date TBD"}
                {requirement.start_time && ` · ${formatTimeOfDay(requirement.start_time)}`}
                {requirement.end_time && ` – ${formatTimeOfDay(requirement.end_time)}`}
                {requirement.guest_count ? ` · ${requirement.guest_count} guests` : ""}
              </div>
            </div>

            {/* Peak season banner */}
            {peakLabel && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 flex items-start gap-2 text-amber-900 dark:text-amber-100">
                <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <div className="font-semibold">Peak season date — {peakLabel}</div>
                  <div className="text-xs opacity-90 mt-0.5">Discuss the rate with the client before confirming. Edit the price below after agreeing. This flag is not shown to the client.</div>
                </div>
              </div>
            )}

            {/* Services */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Services</Label>
              </div>
              <div className="space-y-2">
                {services.map((it, idx) => (
                  <ServiceRow
                    key={idx}
                    item={it}
                    catalog={servicesCatalog}
                    onChange={(next) => setServices(services.map((x, i) => i === idx ? next : x))}
                    onRemove={() => setServices(services.filter((_, i) => i !== idx))}
                  />
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setServices([...services, { name: "", price: 0, quantity: 1 }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add service
              </Button>
            </section>

            {/* Add-ons */}
            <section className="space-y-2">
              <Label className="text-sm font-semibold">Add-ons</Label>
              <div className="space-y-2">
                {addons.length === 0 && <div className="text-xs text-muted-foreground">No add-ons yet.</div>}
                {addons.map((it, idx) => (
                  <AddonRow
                    key={idx}
                    item={it}
                    catalog={addonsCatalog}
                    onChange={(next) => setAddons(addons.map((x, i) => i === idx ? next : x))}
                    onRemove={() => setAddons(addons.filter((_, i) => i !== idx))}
                  />
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setAddons([...addons, { name: "", price: 0 }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add add-on
              </Button>
            </section>

            {/* Summary */}
            <section className="space-y-3 bg-card border rounded-md p-3">
              <Row label="Subtotal" value={formatINR(subtotal)} />

              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Discount</Label>
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setDiscountMode("percent")}
                      className={`px-2 py-0.5 rounded ${discountMode === "percent" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    >%</button>
                    <button
                      type="button"
                      onClick={() => setDiscountMode("amount")}
                      className={`px-2 py-0.5 rounded ${discountMode === "amount" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    >₹</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {discountMode === "percent" ? (
                    <Input type="number" min={0} max={100} step="0.1" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} placeholder="0" />
                  ) : (
                    <Input type="number" min={0} value={discountAmount} onChange={(e) => setDiscountAmount(Number(e.target.value))} placeholder="0" />
                  )}
                  <div className="flex items-center justify-end text-sm">−{formatINR(effDiscountAmount)} <span className="text-xs text-muted-foreground ml-1">({effDiscountPercent.toFixed(1)}%)</span></div>
                </div>
                {effDiscountAmount > 0 && (
                  <Input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder={requireReason ? "Reason for discount (required)" : "Reason for discount"} />
                )}
                {discountOverLimit && (
                  <div className="text-xs text-rose-600 dark:text-rose-400">
                    Discount exceeds your limit ({myMax}%). Request super admin approval.
                  </div>
                )}
                {reasonMissing && (
                  <div className="text-xs text-rose-600 dark:text-rose-400">Reason is required when a discount is applied.</div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Switch checked={gstApplied} onCheckedChange={setGstApplied} id="gst" />
                  <Label htmlFor="gst" className="text-xs text-muted-foreground">
                    {gstApplied ? `Apply GST (${gstPercent}%)` : "GST exempt"}
                  </Label>
                </div>
                {gstApplied && (
                  <Input className="w-20 h-8" type="number" min={0} step="0.1" value={gstPercent} onChange={(e) => setGstPercent(Number(e.target.value))} />
                )}
              </div>
              {gstApplied && <Row label="GST" value={formatINR(gstAmount)} />}

              <div className="flex items-center justify-between pt-3 border-t">
                <div className="text-sm font-semibold">Total</div>
                <div className="text-2xl font-bold">{formatINR(total)}</div>
              </div>
            </section>

            {/* Version history */}
            <section>
              <button type="button" onClick={() => setShowHistory((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <History className="h-3.5 w-3.5" /> Version history {history.length > 0 && `(${history.length})`}
              </button>
              {showHistory && (
                <div className="mt-2 space-y-1.5">
                  {history.length === 0 && <div className="text-xs text-muted-foreground">No previous versions.</div>}
                  {history.map((q) => (
                    <div key={q.id} className="text-xs bg-muted/40 border rounded px-2.5 py-1.5 flex items-center justify-between">
                      <span>v{q.version} · {formatINR(Number(q.total))} · <span className="capitalize">{q.status}</span></span>
                      <span className="text-muted-foreground">{formatDateTimeIN(q.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Sticky footer */}
        <div className="border-t p-3 bg-background flex items-center justify-between gap-2">
          <div className="text-[11px] text-muted-foreground">
            {saving ? "Saving…" : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : "Auto-saves every 30s"}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => saveDraft(false)} disabled={saving || loading}>
              <Save className="h-4 w-4 mr-1" /> Save draft
            </Button>
            <Button
              className="bg-primary"
              disabled={!canSubmit || saving || loading}
              onClick={async () => {
                const id = await saveDraft(true);
                if (!id) return;
                // mark as sent
                await supabase.from("quotations").update({ status: "sent", sent_at: new Date().toISOString(), sent_via: "whatsapp" }).eq("id", id);
                await supabase.from("activity_logs").insert({
                  lead_id: leadId,
                  action: `Quotation v${baseVersion} saved and sent via WhatsApp`,
                  action_type: "system", performed_by: profile?.id ?? null,
                  metadata: { quotation_id: id, total },
                });
                if (onContinueToSend) onContinueToSend(id);
                onSaved?.();
                toast.success("Quotation saved and sent ✓");
                onOpenChange(false);
              }}
            >
              Save & Send
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ServiceRow({ item, catalog, onChange, onRemove }: {
  item: LineItem;
  catalog: ServiceCatalogItem[];
  onChange: (it: LineItem) => void;
  onRemove: () => void;
}) {
  const matched = catalog.find((c) => c.name === item.name);
  const selectValue = matched ? item.name : item.name ? CUSTOM : "";
  return (
    <div className="bg-card border rounded-md p-2.5 space-y-2">
      <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
        <Select
          value={selectValue}
          onValueChange={(v) => {
            if (v === CUSTOM) { onChange({ ...item, name: "" }); return; }
            const c = catalog.find((x) => x.name === v);
            onChange({ ...item, name: v, price: c?.price ?? item.price });
          }}
        >
          <SelectTrigger className="h-9"><SelectValue placeholder="Select service" /></SelectTrigger>
          <SelectContent>
            {catalog.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}{c.price ? ` — ${formatINR(c.price)}` : ""}</SelectItem>)}
            <SelectItem value={CUSTOM}>+ Custom…</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={onRemove} aria-label="Remove">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {selectValue === CUSTOM && (
        <Input value={item.name} onChange={(e) => onChange({ ...item, name: e.target.value })} placeholder="Service name" />
      )}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Qty</Label>
          <Input type="number" min={1} value={item.quantity} onChange={(e) => onChange({ ...item, quantity: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Unit ₹</Label>
          <Input type="number" min={0} value={item.price} onChange={(e) => onChange({ ...item, price: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Line total</Label>
          <div className="h-9 px-3 flex items-center text-sm font-medium border rounded-md bg-muted/30">
            {formatINR((Number(item.price) || 0) * (Number(item.quantity) || 0))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddonRow({ item, catalog, onChange, onRemove }: {
  item: AddonItem;
  catalog: AddonCatalogItem[];
  onChange: (it: AddonItem) => void;
  onRemove: () => void;
}) {
  const matched = catalog.find((c) => c.name === item.name);
  const selectValue = matched ? item.name : item.name ? CUSTOM : "";
  return (
    <div className="bg-card border rounded-md p-2.5 grid grid-cols-[1fr_110px_auto] gap-2 items-start">
      <div className="space-y-2">
        <Select
          value={selectValue}
          onValueChange={(v) => {
            if (v === CUSTOM) { onChange({ ...item, name: "" }); return; }
            const c = catalog.find((x) => x.name === v);
            onChange({ name: v, price: c?.price ?? item.price });
          }}
        >
          <SelectTrigger className="h-9"><SelectValue placeholder="Select add-on" /></SelectTrigger>
          <SelectContent>
            {catalog.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}{c.price ? ` — ${formatINR(c.price)}` : ""}</SelectItem>)}
            <SelectItem value={CUSTOM}>+ Custom…</SelectItem>
          </SelectContent>
        </Select>
        {selectValue === CUSTOM && (
          <Input value={item.name} onChange={(e) => onChange({ ...item, name: e.target.value })} placeholder="Add-on name" />
        )}
      </div>
      <Input type="number" min={0} value={item.price} onChange={(e) => onChange({ ...item, price: Number(e.target.value) })} placeholder="Price" />
      <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={onRemove} aria-label="Remove">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
