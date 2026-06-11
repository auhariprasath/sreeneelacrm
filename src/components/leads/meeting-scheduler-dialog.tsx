import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimeClockField } from "@/components/ui/time-clock-picker";
import { DateConfirmField } from "@/components/ui/date-confirm-field";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Calendar, Send, MapPin, Loader2 } from "lucide-react";
import { formatDateIN, formatTimeOfDay } from "@/lib/format";
import { buildWaMeLink, openWaMeLink } from "@/lib/utils";
import { WA_TEMPLATES } from "@/lib/wa-templates";

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
    const defaultBody = WA_TEMPLATES.find((t) => t.key === "meeting_confirmed")?.defaultBody ?? "";
    const templateBody = (company as any)?.wa_templates?.meeting_confirmed?.body ?? defaultBody;
    return templateBody
      .replace(/\[Name\]/g, leadName)
      .replace(/\[Company\]/g, company?.name ?? "")
      .replace(/\[Meeting date\]/g, formatDateIN(date))
      .replace(/\[Meeting time\]/g, formatTimeOfDay(time))
      .replace(/\[Duration\]/g, String(duration))
      .replace(/\[Address\]/g, (company as any)?.full_address ?? "")
      .replace(/\[Maps link\]/g, (company as any)?.google_maps_link ?? "")
      .replace(/\[Contact person\]/g, contactName)
      .replace(/\[Contact phone\]/g, contactPhone);
  };

  const goPreview = () => {
    setMessage(buildMessage());
    // Auto-select up to 3 venue photos if none selected yet
    if (selectedPhotos.size === 0 && photos.length > 0) {
      setSelectedPhotos(new Set(photos.slice(0, 3).map((p) => p.path)));
    }
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

    // Only one active reminder per lead — close any pending follow-ups or older venue meetings.
    const { closeOtherActiveReminders } = await import("@/lib/lead-reminders");
    await closeOtherActiveReminders(leadId, { kind: "venue_meeting", venueMeetingId: (meeting as any).id });

    await supabase.from("leads").update({ status: "venue_meeting" }).eq("id", leadId);
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
      // Do NOT append signed photo URLs — they are 250+ chars each and blow past
      // WhatsApp's URL length limit, causing the entire ?text= param to be silently
      // dropped so nothing appears in the chat.  Photos must be attached manually.
      const url = buildWaMeLink(leadPhone, finalMsg);
      if (url) openWaMeLink(url);
    }

    const photoHint = send && selectedPhotoUrls.length > 0
      ? ` Attach the ${selectedPhotoUrls.length} selected photo${selectedPhotoUrls.length > 1 ? "s" : ""} manually in WhatsApp.`
      : "";
    toast.success((send ? "Meeting scheduled & WhatsApp opened ✓" : "Meeting scheduled ✓") + photoHint);
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
                <DateConfirmField value={date} onChange={setDate} fromDate={new Date(today)} />
              </div>
              <div className="space-y-1.5">
                <Label>Time</Label>
                <TimeClockField value={time} onChange={setTime} />
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
              <div className="text-xs text-warning dark:text-warning bg-warning/10 border border-warning/30 rounded p-2">
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
              <Button onClick={() => submit(true)} disabled={saving} className="bg-success hover:bg-success text-white">
                <Send className="h-4 w-4 mr-1" /> Send to {leadName}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
