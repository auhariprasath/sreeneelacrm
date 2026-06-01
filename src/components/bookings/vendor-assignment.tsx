import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Briefcase, Plus, CheckCircle2, AlertTriangle, Star, MessageSquare, Trash2, UserPlus,
} from "lucide-react";
import { formatINR, formatDateIN, formatTimeOfDay } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type Vendor = Database["public"]["Tables"]["vendors"]["Row"];
type BookingVendor = Database["public"]["Tables"]["booking_vendors"]["Row"];

interface Props {
  bookingId: string;
  companyId: string;
  eventDate: string;
  startTime: string | null;
  venue: string | null;
  clientName: string;
}

function waSend(num: string | null | undefined, msg: string) {
  if (!num) { toast.error("Vendor has no WhatsApp number on file."); return; }
  const digits = num.replace(/\D/g, "").replace(/^91/, "");
  window.open(`https://wa.me/91${digits}?text=${encodeURIComponent(msg)}`, "_blank");
}

export function VendorAssignment(props: Props) {
  const { bookingId, companyId, eventDate, startTime, venue, clientName } = props;
  const { profile } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [assigned, setAssigned] = useState<(BookingVendor & { vendor?: Vendor | null })[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ vendor_id: string; service_description: string; amount_agreed: string }>({
    vendor_id: "", service_description: "", amount_agreed: "",
  });
  const [noShowOpen, setNoShowOpen] = useState<BookingVendor | null>(null);
  const [noShowNote, setNoShowNote] = useState("");
  const [backupOpen, setBackupOpen] = useState<{ original: BookingVendor; service_type: string } | null>(null);
  const [ratingOpen, setRatingOpen] = useState<BookingVendor | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");

  const load = async () => {
    const [vRes, aRes] = await Promise.all([
      supabase.from("vendors").select("*").eq("company_id", companyId)
        .eq("is_active", true).is("deleted_at", null).order("service_type").order("name"),
      supabase.from("booking_vendors").select("*").eq("booking_id", bookingId).order("created_at"),
    ]);
    const vs = (vRes.data as Vendor[]) ?? [];
    const as = (aRes.data as BookingVendor[]) ?? [];
    setVendors(vs);
    // manual join vendor lookups
    const byId = new Map(vs.map((v) => [v.id, v]));
    // also lookup vendors not in the active list (e.g. deactivated since assignment)
    const missing = as.map((a) => a.vendor_id).filter((id) => !byId.has(id));
    let extras: Vendor[] = [];
    if (missing.length) {
      const { data } = await supabase.from("vendors").select("*").in("id", missing);
      extras = (data as Vendor[]) ?? [];
      extras.forEach((v) => byId.set(v.id, v));
    }
    setAssigned(as.map((a) => ({ ...a, vendor: byId.get(a.vendor_id) ?? null })));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [bookingId, companyId]);

  const assignedIds = useMemo(() => new Set(assigned.map((a) => a.vendor_id)), [assigned]);

  const availableVendors = useMemo(
    () => vendors.filter((v) => !assignedIds.has(v.id)),
    [vendors, assignedIds]
  );

  const addAssignment = async () => {
    if (!draft.vendor_id) { toast.error("Pick a vendor."); return; }
    const v = vendors.find((x) => x.id === draft.vendor_id);
    const payload = {
      booking_id: bookingId,
      company_id: companyId,
      vendor_id: draft.vendor_id,
      service_description: draft.service_description.trim() || v?.service_type || null,
      amount_agreed: draft.amount_agreed ? Number(draft.amount_agreed) : (v?.standard_rate ?? null),
    };
    const { error } = await supabase.from("booking_vendors").insert(payload);
    if (error) { toast.error(error.message); return; }
    // bump vendor.total_bookings
    if (v) {
      await supabase.from("vendors").update({ total_bookings: (v.total_bookings ?? 0) + 1 }).eq("id", v.id);
    }
    toast.success("Vendor assigned ✓");
    setAdding(false);
    setDraft({ vendor_id: "", service_description: "", amount_agreed: "" });
    await load();

    // Auto WA notify if company toggle on
    const { data: co } = await supabase.from("companies")
      .select("auto_notify_vendor_on_assign,name").eq("id", companyId).maybeSingle();
    if (co?.auto_notify_vendor_on_assign && v?.wa_number) {
      const msg = `Hi ${v.name}, you've been assigned to an event on ${formatDateIN(eventDate)}${startTime ? ` at ${formatTimeOfDay(startTime)}` : ""}${venue ? ` (${venue})` : ""}. Service: ${payload.service_description ?? v.service_type}. — ${co.name}`;
      waSend(v.wa_number, msg);
    }
  };

  const removeAssignment = async (a: BookingVendor) => {
    if (!confirm("Remove this vendor from the booking?")) return;
    const { error } = await supabase.from("booking_vendors").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Vendor removed");
    load();
  };

  const confirmVendor = async (a: BookingVendor & { vendor?: Vendor | null }) => {
    const { error } = await supabase.from("booking_vendors")
      .update({ confirmed: true, confirmed_at: new Date().toISOString() }).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${a.vendor?.name ?? "Vendor"} marked confirmed`);
    load();
  };

  const sendReminder = (a: BookingVendor & { vendor?: Vendor | null }) => {
    const v = a.vendor;
    const msg = `Hi ${v?.name ?? ""}, confirming your service for ${clientName}'s event on ${formatDateIN(eventDate)}${startTime ? ` at ${formatTimeOfDay(startTime)}` : ""}${venue ? ` (${venue})` : ""}. Please confirm by replying YES.`;
    waSend(v?.wa_number, msg);
  };

  const submitNoShow = async () => {
    if (!noShowOpen) return;
    const { error } = await supabase.from("booking_vendors").update({
      no_show: true,
      no_show_logged_at: new Date().toISOString(),
      no_show_note: noShowNote.trim() || null,
    }).eq("id", noShowOpen.id);
    if (error) { toast.error(error.message); return; }
    // Auto-log to event_day_logs
    const vendor = assigned.find((x) => x.id === noShowOpen.id)?.vendor;
    await supabase.from("event_day_logs").insert({
      booking_id: bookingId,
      company_id: companyId,
      log_type: "vendor_no_show",
      title: `Vendor no-show: ${vendor?.name ?? "Unknown"}`,
      description: noShowNote.trim() || `${vendor?.service_type ?? "Vendor"} did not arrive.`,
      severity: "high",
      logged_by: profile?.id ?? null,
    });
    toast.error(`${vendor?.name ?? "Vendor"} flagged as no-show. Logged on event day.`);
    setNoShowOpen(null); setNoShowNote("");
    // open backup suggestion picker
    if (vendor) setBackupOpen({ original: noShowOpen, service_type: vendor.service_type });
    load();
  };

  const submitRating = async () => {
    if (!ratingOpen) return;
    const a = ratingOpen;
    const vendor = assigned.find((x) => x.id === a.id)?.vendor;
    const { error } = await supabase.from("booking_vendors").update({
      rating: ratingValue,
      rating_comment: ratingComment.trim() || null,
      rated_at: new Date().toISOString(),
    }).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    // Recompute vendor aggregate
    if (vendor) {
      const newCount = (vendor.rating_count ?? 0) + 1;
      const prevAvg = Number(vendor.rating ?? 0);
      const newAvg = ((prevAvg * (vendor.rating_count ?? 0)) + ratingValue) / newCount;
      await supabase.from("vendors")
        .update({ rating: Number(newAvg.toFixed(2)), rating_count: newCount })
        .eq("id", vendor.id);
    }
    toast.success("Rating saved ✓");
    setRatingOpen(null); setRatingValue(5); setRatingComment("");
    load();
  };

  const backupSuggestions = useMemo(() => {
    if (!backupOpen) return [];
    return vendors
      .filter((v) => v.service_type === backupOpen.service_type && v.id !== backupOpen.original.vendor_id)
      .sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0))
      .slice(0, 5);
  }, [backupOpen, vendors]);

  const assignBackup = async (vendorId: string) => {
    if (!backupOpen) return;
    const v = vendors.find((x) => x.id === vendorId);
    await supabase.from("booking_vendors").insert({
      booking_id: bookingId,
      company_id: companyId,
      vendor_id: vendorId,
      service_description: `BACKUP for ${backupOpen.service_type}`,
      amount_agreed: v?.standard_rate ?? null,
    });
    await supabase.from("booking_vendors").update({ backup_vendor_suggested: true })
      .eq("id", backupOpen.original.id);
    if (v) await supabase.from("vendors").update({ total_bookings: (v.total_bookings ?? 0) + 1 }).eq("id", v.id);
    toast.success(`${v?.name ?? "Backup vendor"} assigned`);
    setBackupOpen(null);
    load();
  };

  return (
    <div className="border-t pt-2 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
          <Briefcase className="h-3 w-3" /> Vendors ({assigned.length})
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(true)}>
          <Plus className="h-3 w-3 mr-1" /> Assign vendor
        </Button>
      </div>

      {assigned.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No vendors assigned yet.</p>
      ) : (
        <div className="space-y-1.5">
          {assigned.map((a) => (
            <div key={a.id} className="rounded-md border bg-background p-2 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium flex items-center gap-1.5 flex-wrap">
                    {a.vendor?.name ?? "(deleted vendor)"}
                    <span className="text-[10px] text-muted-foreground">· {a.vendor?.service_type ?? a.service_description}</span>
                    {a.confirmed && <Badge variant="secondary" className="text-[10px] gap-0.5"><CheckCircle2 className="h-2.5 w-2.5" /> Confirmed</Badge>}
                    {a.no_show && <Badge variant="destructive" className="text-[10px] gap-0.5"><AlertTriangle className="h-2.5 w-2.5" /> No-show</Badge>}
                    {a.rating != null && <Badge variant="outline" className="text-[10px] gap-0.5"><Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> {Number(a.rating).toFixed(1)}</Badge>}
                  </div>
                  {a.service_description && a.service_description !== a.vendor?.service_type && (
                    <div className="text-[11px] text-muted-foreground truncate">{a.service_description}</div>
                  )}
                  {a.amount_agreed != null && (
                    <div className="text-[11px] text-muted-foreground">
                      Agreed: <span className="text-foreground">{formatINR(Number(a.amount_agreed))}</span>
                      {Number(a.amount_paid) > 0 && <span> · Paid {formatINR(Number(a.amount_paid))}</span>}
                    </div>
                  )}
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-rose-600 shrink-0"
                  onClick={() => removeAssignment(a)} aria-label="Remove">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {!a.confirmed && !a.no_show && (
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => confirmVendor(a)}>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Mark confirmed
                  </Button>
                )}
                {a.vendor?.wa_number && (
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => sendReminder(a)}>
                    <MessageSquare className="h-3 w-3 mr-1" /> WA
                  </Button>
                )}
                {!a.no_show && (
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-rose-600" onClick={() => { setNoShowOpen(a); setNoShowNote(""); }}>
                    <AlertTriangle className="h-3 w-3 mr-1" /> No-show
                  </Button>
                )}
                {a.rating == null && (
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => { setRatingOpen(a); setRatingValue(5); setRatingComment(""); }}>
                    <Star className="h-3 w-3 mr-1" /> Rate
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign vendor dialog */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign vendor to this booking</DialogTitle>
            <DialogDescription>Choose from your active vendor catalog.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Vendor</Label>
              <Select value={draft.vendor_id} onValueChange={(v) => {
                const vendor = vendors.find((x) => x.id === v);
                setDraft({
                  vendor_id: v,
                  service_description: vendor?.service_type ?? "",
                  amount_agreed: vendor?.standard_rate?.toString() ?? "",
                });
              }}>
                <SelectTrigger><SelectValue placeholder="Pick vendor…" /></SelectTrigger>
                <SelectContent>
                  {availableVendors.length === 0 && (
                    <div className="text-xs text-muted-foreground p-3">No more vendors available. Add some in Settings.</div>
                  )}
                  {availableVendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} <span className="text-muted-foreground">· {v.service_type}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Service description</Label>
              <Input value={draft.service_description}
                onChange={(e) => setDraft({ ...draft, service_description: e.target.value })}
                placeholder="e.g. Veg buffet for 200 guests" />
            </div>
            <div className="space-y-1.5">
              <Label>Amount agreed (₹)</Label>
              <Input type="number" value={draft.amount_agreed}
                onChange={(e) => setDraft({ ...draft, amount_agreed: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button onClick={addAssignment}><UserPlus className="h-4 w-4 mr-1" /> Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* No-show dialog */}
      <Dialog open={!!noShowOpen} onOpenChange={(o) => !o && setNoShowOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark vendor as no-show</DialogTitle>
            <DialogDescription>This will log an event-day incident and offer backup vendor suggestions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>What happened? (optional)</Label>
            <Textarea rows={3} value={noShowNote} onChange={(e) => setNoShowNote(e.target.value)}
              placeholder="e.g. Didn't arrive by 6pm despite confirmation." />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNoShowOpen(null)}>Cancel</Button>
            <Button variant="destructive" onClick={submitNoShow}>Confirm no-show</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup suggestions dialog */}
      <Dialog open={!!backupOpen} onOpenChange={(o) => !o && setBackupOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suggest a backup vendor</DialogTitle>
            <DialogDescription>Top-rated active vendors for {backupOpen?.service_type}.</DialogDescription>
          </DialogHeader>
          {backupSuggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3">No other vendors available for this service type.</p>
          ) : (
            <div className="space-y-2">
              {backupSuggestions.map((v) => (
                <button key={v.id} onClick={() => assignBackup(v.id)}
                  className="w-full text-left border rounded-md p-3 hover:bg-accent transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{v.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {v.rating ? Number(v.rating).toFixed(1) : "—"}</span>
                        <span>· {v.total_bookings} bookings</span>
                        {v.standard_rate != null && <span>· {formatINR(Number(v.standard_rate))}</span>}
                      </div>
                    </div>
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBackupOpen(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rating dialog */}
      <Dialog open={!!ratingOpen} onOpenChange={(o) => !o && setRatingOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate vendor performance</DialogTitle>
            <DialogDescription>Your rating updates the vendor's overall score.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRatingValue(n)} aria-label={`${n} star`}>
                  <Star className={`h-7 w-7 ${n <= ratingValue ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                </button>
              ))}
              <span className="ml-2 text-sm font-medium">{ratingValue}/5</span>
            </div>
            <div className="space-y-1.5">
              <Label>Comment (optional)</Label>
              <Textarea rows={3} value={ratingComment} onChange={(e) => setRatingComment(e.target.value)}
                placeholder="What went well or poorly?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRatingOpen(null)}>Cancel</Button>
            <Button onClick={submitRating}>Save rating</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
