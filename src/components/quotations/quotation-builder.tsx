import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Trash2, Sparkles, Save, Check, ChevronLeft, ChevronRight,
  MessageCircle, Mail, Copy, Download, FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatINR, formatDateIN, formatTimeOfDay, addHoursToTime } from "@/lib/format";
import { toast } from "sonner";
import { generateQuotationPdf, downloadBlob, type QuotationPdfInput } from "@/lib/quotation-pdf";
import type { Database } from "@/integrations/supabase/types";

type Requirement = Database["public"]["Tables"]["requirements"]["Row"];
type Quotation = Database["public"]["Tables"]["quotations"]["Row"];

interface LineItem { name: string; price: number; quantity: number }
interface AddonItem { name: string; price: number; quantity?: number; unit?: string }
interface CatalogItem { name: string; price?: number }
interface PeakRange { start: string; end: string; label?: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  companyId: string;
  requirementId: string | null;
  quotationId?: string | null;
  /** Open as a NEW revision based on this existing quotation (copies content, increments version). */
  reviseFromId?: string | null;
  onSaved?: () => void;
  onContinueToSend?: (quotationId: string) => void;
}

const STEPS = ["Event", "Services", "Pricing", "Preview"] as const;

export function QuotationBuilder({
  open, onOpenChange, leadId, companyId, requirementId, quotationId, reviseFromId, onSaved, onContinueToSend,
}: Props) {
  const { role, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Event (editable)
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [evType, setEvType] = useState("");
  const [evDate, setEvDate] = useState("");
  const [evStart, setEvStart] = useState("");
  const [evEnd, setEvEnd] = useState("");
  const [evDuration, setEvDuration] = useState<number>(4);
  const [evGuests, setEvGuests] = useState<number | "">("");
  const [evVenue, setEvVenue] = useState("");
  const [evNotes, setEvNotes] = useState("");

  // Catalog + company settings
  const [servicesCatalog, setServicesCatalog] = useState<CatalogItem[]>([]);
  const [addonsCatalog, setAddonsCatalog] = useState<CatalogItem[]>([]);
  const [staffMax, setStaffMax] = useState(5);
  const [adminMax, setAdminMax] = useState(15);
  const [requireReason, setRequireReason] = useState(true);
  const [peakLabel, setPeakLabel] = useState<string | null>(null);
  const [company, setCompany] = useState<Database["public"]["Tables"]["companies"]["Row"] | null>(null);
  const [lead, setLead] = useState<Database["public"]["Tables"]["leads"]["Row"] | null>(null);

  // Quotation state
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
  const [revisingFromId, setRevisingFromId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Preview message
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState<string | null>(null);

  // Load
  useEffect(() => {
    if (!open || !requirementId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: req }, { data: comp }, { data: ld }, { data: addOnsRows }, { data: prior }] = await Promise.all([
        supabase.from("requirements").select("*").eq("id", requirementId).maybeSingle(),
        supabase.from("companies").select("*").eq("id", companyId).maybeSingle(),
        supabase.from("leads").select("*").eq("id", leadId).maybeSingle(),
        supabase.from("add_ons_selected").select("addon_name,addon_price").eq("requirement_id", requirementId),
        supabase.from("quotations").select("*").eq("lead_id", leadId).is("deleted_at", null).order("version", { ascending: false }),
      ]);
      if (cancelled) return;
      if (!req) { toast.error("Requirement not found"); onOpenChange(false); return; }
      setRequirement(req as Requirement);
      setLead(ld as any);
      setCompany(comp as any);
      const r = req as Requirement;
      setEvType(r.event_type || "");
      setEvDate(r.event_date || "");
      setEvStart(r.start_time || "");
      setEvEnd(r.end_time || "");
      setEvDuration(Number((r as any).duration_hours ?? 4));
      setEvGuests(r.guest_count ?? "");
      setEvVenue("");
      setEvNotes(r.notes || "");

      const c = comp as any;
      setServicesCatalog(Array.isArray(c?.services_catalog) ? c.services_catalog : []);
      setAddonsCatalog(Array.isArray(c?.addons_catalog) ? c.addons_catalog : []);
      const gp = Number(c?.gst_percent ?? 18); setGstPercent(gp);
      setStaffMax(Number(c?.staff_max_discount_percent ?? 5));
      setAdminMax(Number(c?.admin_max_discount_percent ?? 15));
      setRequireReason(Boolean(c?.require_discount_reason ?? true));

      const ranges: PeakRange[] = Array.isArray(c?.peak_season_dates) ? c.peak_season_dates : [];
      if (r.event_date) {
        const ed = r.event_date as string;
        const hit = ranges.find((rg) => rg.start && rg.end && ed >= rg.start && ed <= rg.end);
        setPeakLabel(hit ? (hit.label || "Peak season") : null);
      } else setPeakLabel(null);

      const allHistory = (prior as Quotation[]) ?? [];
      const sourceForRevise = reviseFromId ? allHistory.find((q) => q.id === reviseFromId) : null;
      const base = sourceForRevise
        ? null
        : quotationId
          ? allHistory.find((q) => q.id === quotationId)
          : allHistory.find((q) => q.status === "draft");
      if (sourceForRevise) {
        // Revising: copy contents, but treat as a brand-new draft with next version
        setDraftId(null);
        setRevisingFromId(sourceForRevise.id);
        setBaseVersion((allHistory[0]?.version ?? sourceForRevise.version) + 1);
        setServices(((sourceForRevise.services as any) ?? []) as LineItem[]);
        setAddons(((sourceForRevise.addons as any) ?? []) as AddonItem[]);
        const dp = Number(sourceForRevise.discount_percent || 0); const da = Number(sourceForRevise.discount_amount || 0);
        if (dp > 0 && da === 0) { setDiscountMode("percent"); setDiscountPercent(dp); }
        else if (da > 0) { setDiscountMode("amount"); setDiscountAmount(da); }
        else { setDiscountMode("percent"); setDiscountPercent(0); setDiscountAmount(0); }
        setDiscountReason(sourceForRevise.discount_reason ?? "");
        setGstApplied(sourceForRevise.gst_applied ?? true);
        setGstPercent(Number(sourceForRevise.gst_percent ?? gp));
      } else if (base) {
        setDraftId(base.id);
        setRevisingFromId(null);
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
        setRevisingFromId(null);
        setAddons(((addOnsRows as any[]) ?? []).map((a) => ({ name: a.addon_name, price: Number(a.addon_price) || 0 })));
        setServices([]);
        setBaseVersion((allHistory[0]?.version ?? 0) + 1);
      }
      setStep(0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requirementId, companyId, leadId, quotationId, reviseFromId]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setDraftId(null); setRequirement(null); setRevisingFromId(null);
      setServices([]); setAddons([]); setDiscountPercent(0); setDiscountAmount(0); setDiscountReason("");
      setGstApplied(true); setLastSaved(null); setStep(0);
    }
  }, [open]);

  // Totals
  const subtotal = useMemo(
    () => services.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0)
        + addons.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0),
    [services, addons],
  );
  const effDiscountAmount = useMemo(() => {
    if (discountMode === "percent") return Math.round((subtotal * (Number(discountPercent) || 0)) / 100);
    return Math.min(Number(discountAmount) || 0, subtotal);
  }, [discountMode, discountPercent, discountAmount, subtotal]);
  const effDiscountPercent = useMemo(() => {
    if (subtotal <= 0) return 0;
    return discountMode === "percent" ? (Number(discountPercent) || 0) : (effDiscountAmount / subtotal) * 100;
  }, [discountMode, discountPercent, effDiscountAmount, subtotal]);
  const afterDiscount = Math.max(0, subtotal - effDiscountAmount);
  const gstAmount = gstApplied ? Math.round((afterDiscount * (Number(gstPercent) || 0)) / 100) : 0;
  const total = afterDiscount + gstAmount;

  const myMax = role === "super_admin" ? Infinity : role === "admin" ? adminMax : staffMax;
  const discountOverLimit = effDiscountPercent > myMax + 0.0001;
  const reasonMissing = effDiscountAmount > 0 && requireReason && !discountReason.trim();
  const hasValidServices = services.some((s) => s.name.trim() && (Number(s.price) || 0) > 0 && (Number(s.quantity) || 0) > 0);

  // Save event details to requirement (called when leaving step 0)
  const persistEvent = async () => {
    if (!requirement) return;
    const patch: Partial<Requirement> = {
      event_type: evType || null,
      event_date: evDate || null,
      start_time: evStart || null,
      end_time: evEnd || null,
      duration_hours: evDuration || null,
      guest_count: evGuests === "" ? null : Number(evGuests),
      notes: evNotes || null,
    } as any;
    await supabase.from("requirements").update(patch).eq("id", requirement.id);
    setRequirement({ ...requirement, ...(patch as any) });
  };

  // Save draft quotation
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
      // Preserve existing status when editing — don't downgrade sent/agreed quotes back to draft
      const { status: _ignored, ...updatePayload } = payload;
      const { error } = await supabase.from("quotations").update(updatePayload).eq("id", id);
      if (error) { setSaving(false); if (!silent) toast.error(error.message); return null; }
    } else {
      const { data, error } = await supabase.from("quotations").insert(payload).select("id").single();
      if (error || !data) { setSaving(false); if (!silent) toast.error(error?.message || "Couldn't save draft"); return null; }
      id = data.id; setDraftId(id);

      // First save of a revision: archive the source quotation and notify admins on 3+ revisions
      if (revisingFromId) {
        const archivedFrom = revisingFromId;
        setRevisingFromId(null);
        await supabase.from("quotations").update({ status: "revised" }).eq("id", archivedFrom);
        await supabase.from("activity_logs").insert({
          lead_id: leadId,
          action: `Quotation revised — new v${baseVersion} created from v${baseVersion - 1}`,
          action_type: "system",
          performed_by: profile?.id ?? null,
          metadata: { quotation_id: id, revised_from: archivedFrom, version: baseVersion },
        });
        if (baseVersion >= 4) {
          const { data: admins } = await supabase
            .from("user_roles")
            .select("user_id, profiles!inner(company_id)")
            .in("role", ["admin", "super_admin"])
            .eq("profiles.company_id", companyId);
          const rows = (admins ?? []).map((a: any) => ({
            user_id: a.user_id,
            title: "Review quotation revisions",
            body: `${baseVersion - 1} revisions done on ${lead?.full_name ?? "lead"} — please review.`,
            type: "system" as const,
            lead_id: leadId,
          }));
          if (rows.length) await supabase.from("notifications").insert(rows);
        }
      }
    }
    setSaving(false);
    setLastSaved(new Date());
    if (!silent) toast.success("Draft saved");
    onSaved?.();
    return id;
  };

  // Auto-save every 30s
  const autoSaveRef = useRef<number | null>(null);
  useEffect(() => {
    if (!open || loading || !requirement) return;
    if (autoSaveRef.current) window.clearInterval(autoSaveRef.current);
    autoSaveRef.current = window.setInterval(() => { saveDraft(true).catch(() => {}); }, 30_000);
    return () => { if (autoSaveRef.current) window.clearInterval(autoSaveRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading, requirement, services, addons, discountMode, discountPercent, discountAmount, discountReason, gstApplied, gstPercent]);

  // PDF
  const pdfInput: QuotationPdfInput | null = useMemo(() => {
    if (!requirement || !company || !lead) return null;
    return {
      company: {
        name: company.name, address: company.address, email: company.email, wa_number: company.wa_number,
        gstin: company.gstin, upi_id: company.upi_id, bank_account: company.bank_account, ifsc: company.ifsc,
        logo_url: company.logo_url, cancellation_policy: company.cancellation_policy,
      },
      client: { name: lead.full_name, phone: lead.phone },
      event: {
        type: evType, date: evDate || null, start_time: evStart || null, end_time: evEnd || null,
        venue: evVenue || null, guest_count: evGuests === "" ? null : Number(evGuests),
        duration_hours: evDuration || null,
      },
      quotation: {
        number: null, version: baseVersion,
        services, addons,
        subtotal, discount_percent: Number(effDiscountPercent.toFixed(2)), discount_amount: effDiscountAmount,
        gst_applied: gstApplied, gst_percent: gstPercent, gst_amount: gstAmount, total,
        created_at: new Date().toISOString(),
      },
    };
  }, [requirement, company, lead, evType, evDate, evStart, evEnd, evVenue, evGuests, baseVersion, services, addons, subtotal, effDiscountPercent, effDiscountAmount, gstApplied, gstPercent, gstAmount, total]);

  const pdfFilename = `Quotation-${(lead?.full_name || "client").replace(/\s+/g, "_")}-v${baseVersion}.pdf`;
  const buildPdf = async (): Promise<Blob | null> => pdfInput ? await generateQuotationPdf({ ...pdfInput, authorisedBy: profile?.full_name ?? null }) : null;

  // Build preview message when entering step 4
  useEffect(() => {
    if (step !== 3 || !lead || !company) return;
    const tmpl = `Namaste ${lead.full_name}, here is your quotation from ${company.name} for ${evType || "your event"}${evDate ? ` on ${formatDateIN(evDate)}` : ""}.\n\nTotal: ${formatINR(total)}\n\nReply AGREED to confirm, or let us know if you'd like changes. Thank you!`;
    setMessage(tmpl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Step nav
  const canNext = () => {
    if (step === 0) return !!evType && !!evDate;
    if (step === 1) return hasValidServices;
    if (step === 2) return !discountOverLimit && !reasonMissing;
    return true;
  };
  const goNext = async () => {
    if (!canNext()) return;
    if (step === 0) { await persistEvent(); }
    if (step === 1 || step === 2) { await saveDraft(true); }
    setStep((s) => Math.min(3, s + 1));
  };
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  // Send actions
  const markSent = async (channel: "whatsapp" | "email" | null, label: string, id: string) => {
    const patch: any = { status: "sent", sent_at: new Date().toISOString() };
    if (channel) patch.sent_via = channel;
    await supabase.from("quotations").update(patch).eq("id", id);
    await supabase.from("activity_logs").insert({
      lead_id: leadId,
      action: `Quotation v${baseVersion} sent via ${label}`,
      action_type: "system", performed_by: profile?.id ?? null,
      metadata: { quotation_id: id, total },
    });
  };
  const sendViaWhatsApp = async () => {
    if (!lead?.phone) { toast.error("Lead has no phone number"); return; }
    setSending("whatsapp");
    try {
      const id = await saveDraft(true); if (!id) return;
      const blob = await buildPdf(); if (blob) downloadBlob(blob, pdfFilename);
      const num = lead.phone.replace(/[^\d]/g, ""); const intl = num.length === 10 ? `91${num}` : num;
      window.open(`https://wa.me/${intl}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
      await markSent("whatsapp", "WhatsApp", id);
      onContinueToSend?.(id); onSaved?.();
      toast.success("WhatsApp opened · PDF downloaded — attach it in the chat");
      onOpenChange(false);
    } finally { setSending(null); }
  };
  const sendViaEmail = async () => {
    setSending("email");
    try {
      const id = await saveDraft(true); if (!id) return;
      const blob = await buildPdf(); if (blob) downloadBlob(blob, pdfFilename);
      const subject = `Quotation from ${company?.name ?? ""} — v${baseVersion}`;
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      await markSent("email", "Email", id);
      onContinueToSend?.(id); onSaved?.();
      toast.success("Email opened · PDF downloaded");
      onOpenChange(false);
    } finally { setSending(null); }
  };
  const copyMessage = async () => {
    await navigator.clipboard.writeText(message);
    toast.success("Message copied");
  };
  const downloadPdf = async () => {
    const blob = await buildPdf(); if (blob) { downloadBlob(blob, pdfFilename); toast.success("PDF downloaded"); }
  };
  const saveAndSend = async () => {
    const id = await saveDraft(true); if (!id) return;
    const blob = await buildPdf(); if (blob) downloadBlob(blob, pdfFilename);
    await markSent("whatsapp", "WhatsApp", id);
    onContinueToSend?.(id); onSaved?.();
    toast.success("Quotation saved and sent ✓");
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>
            Quotation Builder {baseVersion > 1 && <span className="text-xs font-normal text-muted-foreground">· v{baseVersion}</span>}
            {revisingFromId && <span className="ml-2 text-[10px] font-medium rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5">Revising</span>}
          </SheetTitle>
          <StepProgress current={step} />
        </SheetHeader>

        {loading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !requirement ? null : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {peakLabel && step < 3 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 flex items-start gap-2 text-amber-900 dark:text-amber-100">
                <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <div className="font-semibold">Peak season — {peakLabel}</div>
                  <div className="text-xs opacity-90">Discuss the rate with the client before confirming.</div>
                </div>
              </div>
            )}

            {step === 0 && (
              <section className="space-y-3">
                <div className="text-xs text-muted-foreground">Auto-filled from intake form. Confirm or edit before continuing.</div>
                <Field label="Event type *"><Input value={evType} onChange={(e) => setEvType(e.target.value)} placeholder="Wedding, Reception, etc." /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Event date *"><Input type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} /></Field>
                  <Field label="Guest count"><Input type="number" min={0} value={evGuests} onChange={(e) => setEvGuests(e.target.value === "" ? "" : Number(e.target.value))} /></Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Start time">
                    <Input type="time" value={evStart} onChange={(e) => {
                      const t = e.target.value;
                      setEvStart(t);
                      if (t && evDuration) setEvEnd(addHoursToTime(t, evDuration));
                    }} />
                  </Field>
                  <Field label="Duration">
                    <DurationPicker value={evDuration} onChange={(h) => {
                      setEvDuration(h);
                      if (evStart && h) setEvEnd(addHoursToTime(evStart, h));
                    }} />
                  </Field>
                  <Field label="Ends at">
                    <div className="h-9 px-3 flex items-center text-sm border rounded-md bg-muted/30">{evEnd ? formatTimeOfDay(evEnd) : "—"}</div>
                  </Field>
                </div>
                <Field label="Venue (optional)"><Input value={evVenue} onChange={(e) => setEvVenue(e.target.value)} /></Field>
                <Field label="Notes (optional)"><Textarea rows={3} value={evNotes} onChange={(e) => setEvNotes(e.target.value)} /></Field>
              </section>
            )}

            {step === 1 && (
              <section className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold">Services</Label>
                  <div className="text-xs text-muted-foreground mb-2">Tick the services to include. Edit qty/price after selecting.</div>
                  <div className="space-y-1.5">
                    {servicesCatalog.length === 0 && <div className="text-xs text-muted-foreground">No services in catalogue. Add custom below.</div>}
                    {servicesCatalog.map((c) => {
                      const idx = services.findIndex((s) => s.name === c.name);
                      const checked = idx >= 0;
                      return (
                        <label key={c.name} className="flex items-center gap-3 bg-card border rounded-md p-2.5 cursor-pointer hover:bg-muted/30">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              if (v) setServices([...services, { name: c.name, price: c.price ?? 0, quantity: 1 }]);
                              else setServices(services.filter((s) => s.name !== c.name));
                            }}
                          />
                          <div className="flex-1 text-sm">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.price ? formatINR(c.price) : ""}</div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {services.filter((s) => !servicesCatalog.find((c) => c.name === s.name) || true).length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Selected — adjust qty / price</Label>
                    {services.map((it, idx) => (
                      <LineRow key={idx} item={it}
                        onChange={(next) => setServices(services.map((x, i) => i === idx ? next : x))}
                        onRemove={() => setServices(services.filter((_, i) => i !== idx))} />
                    ))}
                  </div>
                )}

                <Button type="button" variant="outline" size="sm" onClick={() => setServices([...services, { name: "", price: 0, quantity: 1 }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add custom service
                </Button>

                <div className="pt-3 border-t">
                  <Label className="text-sm font-semibold">Add-ons</Label>
                  <div className="space-y-1.5 mt-2">
                    {addonsCatalog.map((c) => {
                      const checked = addons.findIndex((a) => a.name === c.name) >= 0;
                      return (
                        <label key={c.name} className="flex items-center gap-3 bg-card border rounded-md p-2.5 cursor-pointer hover:bg-muted/30">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              if (v) setAddons([...addons, { name: c.name, price: c.price ?? 0 }]);
                              else setAddons(addons.filter((a) => a.name !== c.name));
                            }}
                          />
                          <div className="flex-1 text-sm">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.price ? formatINR(c.price) : ""}</div>
                        </label>
                      );
                    })}
                  </div>
                  {addons.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {addons.map((it, idx) => (
                        <AddonInline key={idx} item={it}
                          onChange={(next) => setAddons(addons.map((x, i) => i === idx ? next : x))}
                          onRemove={() => setAddons(addons.filter((_, i) => i !== idx))} />
                      ))}
                    </div>
                  )}
                  <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setAddons([...addons, { name: "", price: 0 }])}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add custom add-on
                  </Button>
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="space-y-3 bg-card border rounded-md p-3">
                <Row label="Subtotal" value={formatINR(subtotal)} />
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Discount</Label>
                    <div className="flex items-center gap-1 text-xs">
                      <button type="button" onClick={() => setDiscountMode("percent")} className={`px-2 py-0.5 rounded ${discountMode === "percent" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>%</button>
                      <button type="button" onClick={() => setDiscountMode("amount")} className={`px-2 py-0.5 rounded ${discountMode === "amount" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>₹</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {discountMode === "percent"
                      ? <Input type="number" min={0} max={100} step="0.1" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} placeholder="0" />
                      : <Input type="number" min={0} value={discountAmount} onChange={(e) => setDiscountAmount(Number(e.target.value))} placeholder="0" />}
                    <div className="flex items-center justify-end text-sm">−{formatINR(effDiscountAmount)} <span className="text-xs text-muted-foreground ml-1">({effDiscountPercent.toFixed(1)}%)</span></div>
                  </div>
                  {effDiscountAmount > 0 && (
                    <Input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder={requireReason ? "Reason for discount (required)" : "Reason for discount"} />
                  )}
                  {discountOverLimit && <div className="text-xs text-rose-600">Discount exceeds your limit ({myMax}%). Request super admin approval.</div>}
                  {reasonMissing && <div className="text-xs text-rose-600">Reason is required when a discount is applied.</div>}
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch checked={gstApplied} onCheckedChange={setGstApplied} id="gst" />
                    <Label htmlFor="gst" className="text-xs text-muted-foreground">{gstApplied ? `Apply GST (${gstPercent}%)` : "GST exempt"}</Label>
                  </div>
                  {gstApplied && <Input className="w-20 h-8" type="number" min={0} step="0.1" value={gstPercent} onChange={(e) => setGstPercent(Number(e.target.value))} />}
                </div>
                {gstApplied && <Row label="GST" value={formatINR(gstAmount)} />}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="text-sm font-semibold">Total</div>
                  <div className="text-2xl font-bold">{formatINR(total)}</div>
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="space-y-3">
                <div className="text-xs text-muted-foreground">This is exactly what the client will see. Edit the message before sending.</div>

                {/* Preview card */}
                <div className="border rounded-md overflow-hidden">
                  <div className="bg-muted/40 p-3 border-b">
                    <div className="font-semibold">{company?.name}</div>
                    <div className="text-xs text-muted-foreground">Quotation · v{baseVersion}</div>
                  </div>
                  <div className="p-3 text-sm space-y-1">
                    <div><span className="text-muted-foreground">Bill to:</span> {lead?.full_name}</div>
                    <div><span className="text-muted-foreground">Event:</span> {evType}{evDate ? ` · ${formatDateIN(evDate)}` : ""}{evStart ? ` ${formatTimeOfDay(evStart)}` : ""}</div>
                    {evGuests !== "" && <div><span className="text-muted-foreground">Guests:</span> {evGuests}</div>}
                  </div>
                  <div className="p-3 border-t text-sm">
                    {services.map((s, i) => (
                      <div key={i} className="flex justify-between py-0.5">
                        <span>{s.name} {s.quantity > 1 ? <span className="text-xs text-muted-foreground">× {s.quantity}</span> : null}</span>
                        <span>{formatINR((Number(s.price) || 0) * (Number(s.quantity) || 0))}</span>
                      </div>
                    ))}
                    {addons.map((a, i) => (
                      <div key={i} className="flex justify-between py-0.5 text-muted-foreground">
                        <span>+ {a.name}</span><span>{formatINR(a.price)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 border-t text-sm space-y-1">
                    <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
                    {effDiscountAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>− {formatINR(effDiscountAmount)}</span></div>}
                    {gstApplied && <div className="flex justify-between text-muted-foreground"><span>GST ({gstPercent}%)</span><span>{formatINR(gstAmount)}</span></div>}
                    <div className="flex justify-between font-semibold text-base pt-1 border-t mt-1"><span>Total</span><span>{formatINR(total)}</span></div>
                  </div>
                  <div className="m-3 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 text-sm">
                    <div className="font-semibold flex items-center gap-1"><Check className="h-4 w-4" /> Ready to confirm?</div>
                    <div className="text-xs mt-1 opacity-90">Reply "AGREED" on WhatsApp{company?.wa_number ? ` to ${company.wa_number}` : ""} to lock the date.</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Message to client (editable)</Label>
                  <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <Button onClick={sendViaWhatsApp} disabled={!!sending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                  </Button>
                  <Button variant="outline" onClick={sendViaEmail} disabled={!!sending}>
                    <Mail className="h-4 w-4 mr-1" /> Email
                  </Button>
                  <Button variant="outline" onClick={copyMessage}><Copy className="h-4 w-4 mr-1" /> Copy</Button>
                  <Button variant="outline" onClick={downloadPdf}><Download className="h-4 w-4 mr-1" /> PDF</Button>
                </div>
              </section>
            )}
          </div>
        )}

        {/* Sticky footer */}
        <div className="border-t p-3 bg-background flex items-center justify-between gap-2">
          <div className="text-[11px] text-muted-foreground">
            {saving ? "Saving…" : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : "Auto-saves every 30s"}
          </div>
          <div className="flex gap-2">
            {step > 0 && <Button variant="ghost" onClick={goBack}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>}
            <Button variant="outline" onClick={() => saveDraft(false)} disabled={saving || loading}>
              <Save className="h-4 w-4 mr-1" /> Save draft
            </Button>
            {step < 3 ? (
              <Button onClick={goNext} disabled={!canNext() || saving || loading}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={saveAndSend} disabled={saving || loading || !hasValidServices} className="bg-primary">
                <FileText className="h-4 w-4 mr-1" /> Save & Send
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StepProgress({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5 pt-2">
      {STEPS.map((label, i) => {
        const done = i < current; const active = i === current;
        return (
          <div key={label} className="flex-1 flex items-center gap-1.5">
            <div className={`flex items-center gap-1.5 ${active ? "text-foreground" : done ? "text-emerald-600" : "text-muted-foreground"}`}>
              <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold border ${active ? "bg-primary text-primary-foreground border-primary" : done ? "bg-emerald-600 text-white border-emerald-600" : "bg-muted border-border"}`}>
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className="text-[11px] font-medium hidden sm:inline">{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${done ? "bg-emerald-600" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}

function LineRow({ item, onChange, onRemove }: { item: LineItem; onChange: (it: LineItem) => void; onRemove: () => void }) {
  return (
    <div className="bg-card border rounded-md p-2.5 space-y-2">
      <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
        <Input value={item.name} onChange={(e) => onChange({ ...item, name: e.target.value })} placeholder="Service name" />
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-[10px] text-muted-foreground">Qty</Label><Input type="number" min={1} value={item.quantity} onChange={(e) => onChange({ ...item, quantity: Number(e.target.value) })} /></div>
        <div><Label className="text-[10px] text-muted-foreground">Unit ₹</Label><Input type="number" min={0} value={item.price} onChange={(e) => onChange({ ...item, price: Number(e.target.value) })} /></div>
        <div><Label className="text-[10px] text-muted-foreground">Line total</Label><div className="h-9 px-3 flex items-center text-sm font-medium border rounded-md bg-muted/30">{formatINR((Number(item.price) || 0) * (Number(item.quantity) || 0))}</div></div>
      </div>
    </div>
  );
}

function AddonInline({ item, onChange, onRemove }: { item: AddonItem; onChange: (it: AddonItem) => void; onRemove: () => void }) {
  return (
    <div className="bg-card border rounded-md p-2.5 grid grid-cols-[1fr_110px_auto] gap-2 items-center">
      <Input value={item.name} onChange={(e) => onChange({ ...item, name: e.target.value })} placeholder="Add-on name" />
      <Input type="number" min={0} value={item.price} onChange={(e) => onChange({ ...item, price: Number(e.target.value) })} placeholder="Price" />
      <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
}
