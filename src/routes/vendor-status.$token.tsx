import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Package, Car, MapPin, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateIN, formatTimeOfDay } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/vendor-status/$token")({ component: VendorStatusPage });

type Stage = "packed" | "traveling" | "arrived" | "setup_done";
const ORDER: Stage[] = ["packed", "traveling", "arrived", "setup_done"];
const META: Record<Stage, { label: string; icon: any; color: string }> = {
  packed:     { label: "Packed and ready",         icon: Package,      color: "bg-blue-500" },
  traveling:  { label: "Started traveling to venue", icon: Car,        color: "bg-amber-500" },
  arrived:    { label: "Reached venue",            icon: MapPin,       color: "bg-orange-500" },
  setup_done: { label: "Setup complete",           icon: CheckCircle2, color: "bg-emerald-500" },
};

interface Booking { id: string; event_date: string; start_time: string | null; venue: string | null; company_id: string }
interface BV { id: string; vendor_id: string; service_description: string | null; booking_id: string }
interface Vendor { name: string; service_type: string }
interface Company { name: string; meeting_contact_name: string | null; meeting_contact_phone: string | null }
interface Update { status: Stage; updated_at: string; updated_via: string }

function VendorStatusPage() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [bv, setBv] = useState<BV | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [saving, setSaving] = useState<Stage | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: bvRow } = await supabase.from("booking_vendors")
      .select("id,vendor_id,service_description,booking_id")
      .eq("status_token" as any, token)
      .maybeSingle();
    if (!bvRow) { setLoading(false); return; }
    setBv(bvRow as any);
    const [{ data: bk }, { data: v }, { data: ups }] = await Promise.all([
      supabase.from("bookings").select("id,event_date,start_time,venue,company_id").eq("id", (bvRow as any).booking_id).maybeSingle(),
      supabase.from("vendors").select("name,service_type").eq("id", (bvRow as any).vendor_id).maybeSingle(),
      supabase.from("vendor_status_updates" as any).select("status,updated_at,updated_via")
        .eq("booking_vendor_id", (bvRow as any).id).order("updated_at", { ascending: true }),
    ]);
    setBooking(bk as any);
    setVendor(v as any);
    setUpdates((ups as any) ?? []);
    if (bk) {
      const { data: c } = await supabase.from("companies")
        .select("name,meeting_contact_name,meeting_contact_phone")
        .eq("id", (bk as any).company_id).maybeSingle();
      setCompany(c as any);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  const doneSet = new Set(updates.map((u) => u.status));
  const nextStage: Stage | null = ORDER.find((s) => !doneSet.has(s)) ?? null;

  const tap = async (stage: Stage) => {
    if (!bv || !booking) return;
    if (doneSet.has(stage)) return;
    if (nextStage !== stage) {
      toast.error(`Please update earlier stages first`);
      return;
    }
    setSaving(stage);
    const { error } = await supabase.from("vendor_status_updates" as any).insert({
      booking_vendor_id: bv.id,
      booking_id: bv.booking_id,
      vendor_id: bv.vendor_id,
      company_id: booking.company_id,
      status: stage,
      updated_via: "tap_link",
    } as any);
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Status updated: ${META[stage].label}`);
    load();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!bv || !booking || !vendor) {
    return <div className="min-h-screen flex items-center justify-center p-4 text-center">
      <div>
        <div className="text-xl font-semibold">Link expired or invalid</div>
        <div className="text-sm text-muted-foreground mt-2">Please contact the team for a fresh link.</div>
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-md mx-auto space-y-4 py-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{vendor.name}</CardTitle>
            <CardDescription>{bv.service_description || vendor.service_type}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div><span className="text-muted-foreground">Event date:</span> <span className="font-medium">{formatDateIN(booking.event_date)}</span></div>
            {booking.start_time && <div><span className="text-muted-foreground">Time:</span> <span className="font-medium">{formatTimeOfDay(booking.start_time)}</span></div>}
            {booking.venue && <div><span className="text-muted-foreground">Venue:</span> <span className="font-medium">{booking.venue}</span></div>}
            {company?.meeting_contact_phone && (
              <div className="pt-2 border-t mt-2 text-xs">
                Issues? Call {company.meeting_contact_name ?? "team"}: <a href={`tel:${company.meeting_contact_phone}`} className="text-primary font-medium">{company.meeting_contact_phone}</a>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          {ORDER.map((s) => {
            const done = doneSet.has(s);
            const isNext = nextStage === s;
            const Icon = META[s].icon;
            const update = updates.find((u) => u.status === s);
            return (
              <button
                key={s}
                onClick={() => tap(s)}
                disabled={done || (!isNext) || saving !== null}
                className={`w-full min-h-[72px] rounded-lg border-2 p-4 flex items-center gap-3 text-left transition-all ${
                  done ? "bg-muted border-muted opacity-60"
                    : isNext ? `${META[s].color} border-transparent text-white hover:opacity-90`
                    : "bg-muted/40 border-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-6 w-6 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{META[s].label}</div>
                  {done && update && <div className="text-xs opacity-80">✓ {new Date(update.updated_at).toLocaleTimeString()}</div>}
                  {isNext && !done && <div className="text-xs opacity-90">Tap when ready</div>}
                </div>
                {saving === s && <Loader2 className="h-5 w-5 animate-spin" />}
              </button>
            );
          })}
        </div>

        <div className="text-center text-xs text-muted-foreground pt-4">
          Powered by {company?.name ?? "Neela CRM"}
        </div>
      </div>
    </div>
  );
}
