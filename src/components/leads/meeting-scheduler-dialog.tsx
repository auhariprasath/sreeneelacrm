import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Calendar, Send, MapPin, Loader2 } from "lucide-react";
import { formatDateIN, formatTimeOfDay } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  leadName: string;
  leadPhone: string;
  companyId: string;
  onScheduled?: () => void;
}

interface VenuePhoto { path: string; url: string }

export function MeetingSchedulerDialog({ open, onOpenChange, leadId, leadName, leadPhone, companyId, onScheduled }: Props) {
  const { profile } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [step, setStep] = useState<"pick" | "preview">("pick");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(60);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [company, setCompany] = useState<any>(null);
  const [photos, setPhotos] = useState<VenuePhoto[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("pick"); setDate(today); setTime("10:00"); setDuration(60);
      setContactName(""); setContactPhone(""); setSelectedPhotos(new Set());
      setMessage(""); setPersonalNote("");
      return;
    }
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("companies").select("*").eq("id", companyId).maybeSingle();
      const c = data as any;
      setCompany(c);
      setContactName(c?.meeting_contact_name ?? "");
      setContactPhone(c?.meeting_contact_phone ?? "");
      const paths = (Array.isArray(c?.venue_photos) ? c.venue_photos : []) as string[];
      const list: VenuePhoto[] = [];
      for (const p of paths) {
        const { data: u } = await supabase.storage.from("venue-photos").createSignedUrl(p, 60 * 60 * 24 * 365);
        if (u?.signedUrl) list.push({ path: p, url: u.signedUrl });
      }
      setPhotos(list);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, companyId]);

  const buildMessage = () => {
    const lines = [
      `Hi ${leadName}! 👋`,
      ``,
      `Thank you for your interest in ${company?.name ?? ""}.`,
      ``,
      `We have scheduled a venue visit for you:`,
      ``,
      `📅 Date: ${formatDateIN(date)}`,
      `⏰ Time: ${formatTimeOfDay(time)}`,
      `📍 Venue: ${company?.name ?? ""}`,
      company?.full_address ? `🏠 Address: ${company.full_address}` : "",
      company?.google_maps_link ? `📍 Google Maps: ${company.google_maps_link}` : "",
      ``,
      contactName ? `You will be meeting: ${contactName}` : "",
      contactPhone ? `📞 Contact: ${contactPhone}` : "",
      ``,
      `We look forward to seeing you! Please confirm your visit.`,
    ].filter(Boolean);
    return lines.join("\n");
  };

  const goPreview = () => {
    setMessage(buildMessage());
    setStep("preview");
  };

  const togglePhoto = (path: string) => {
    const next = new Set(selectedPhotos);
    if (next.has(path)) next.delete(path);
    else if (next.size >= 3) { toast.error("Max 3 photos per WhatsApp message"); return; }
    else next.add(path);
    setSelectedPhotos(next);
  };

  const selectedPhotoUrls = useMemo(
    () => photos.filter((p) => selectedPhotos.has(p.path)),
    [photos, selectedPhotos]
  );

  const submit = async (send: boolean) => {
    setSaving(true);
    const finalMsg = personalNote ? `${message}\n\n${personalNote}` : message;
    const { data: meeting, error } = await supabase.from("venue_meetings").insert({
      lead_id: leadId,
      company_id: companyId,
      scheduled_date: date,
      scheduled_time: time,
      duration_minutes: duration,
      contact_person_name: contactName || null,
      contact_person_phone: contactPhone || null,
      message_sent: finalMsg,
      photos_sent: selectedPhotoUrls.map((p) => p.url) as any,
      created_by: profile?.id ?? null,
    } as any).select("id").single();
    if (error) { setSaving(false); toast.error(error.message); return; }

    await supabase.from("leads").update({ status: "in_progress" }).eq("id", leadId);
    await supabase.from("activity_logs").insert({
      lead_id: leadId,
      action: `Venue meeting scheduled for ${formatDateIN(date)} ${formatTimeOfDay(time)}${send ? ". Confirmation sent." : "."}`,
      action_type: "system",
      performed_by: profile?.id ?? null,
      metadata: { meeting_id: (meeting as any).id },
    });

    // Internal notification
    if (profile?.id) {
      await supabase.from("notifications").insert({
        user_id: profile.id,
        title: "Venue meeting scheduled",
        body: `Meeting with ${leadName} on ${formatDateIN(date)} at ${formatTimeOfDay(time)}`,
        type: "system",
        lead_id: leadId,
      });
    }

    if (send) {
      const num = leadPhone.replace(/\D/g, "").replace(/^91/, "");
      const text = encodeURIComponent(
        finalMsg + (selectedPhotoUrls.length ? `\n\n${selectedPhotoUrls.map((p) => p.url).join("\n")}` : "")
      );
      window.open(`https://wa.me/91${num}?text=${text}`, "_blank", "noopener");
    }

    toast.success(send ? "Meeting scheduled & WhatsApp opened ✓" : "Meeting scheduled ✓");
    setSaving(false);
    onScheduled?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Schedule venue meeting</DialogTitle>
          <DialogDescription>{step === "pick" ? "Pick date and time" : "Preview & send"}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : step === "pick" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Time</Label>
                <Input type="time" step={1800} value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact person</Label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Name" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone" />
              </div>
            </div>
            {!company?.full_address && (
              <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded p-2">
                ⚠ Add the full venue address in Settings → Company details for the confirmation message.
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={goPreview}>Next: Preview</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Message</Label>
              <Textarea rows={10} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Add a personal note (optional)</Label>
              <Input value={personalNote} onChange={(e) => setPersonalNote(e.target.value)} placeholder="Personal note appended at end" />
            </div>
            {photos.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Venue photos ({selectedPhotos.size}/3)</Label>
                  <div className="flex gap-1">
                    <button type="button" className="text-[11px] underline" onClick={() => setSelectedPhotos(new Set(photos.slice(0, 3).map((p) => p.path)))}>Select 3</button>
                    <button type="button" className="text-[11px] underline" onClick={() => setSelectedPhotos(new Set())}>Clear</button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {photos.map((p) => (
                    <button
                      key={p.path}
                      type="button"
                      onClick={() => togglePhoto(p.path)}
                      className={`relative aspect-square border-2 rounded overflow-hidden ${selectedPhotos.has(p.path) ? "border-primary" : "border-transparent"}`}
                    >
                      <img src={p.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setStep("pick")}>Back</Button>
              <Button variant="outline" onClick={() => submit(false)} disabled={saving}>Save without sending</Button>
              <Button onClick={() => submit(true)} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Send className="h-4 w-4 mr-1" /> Send to {leadName}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
