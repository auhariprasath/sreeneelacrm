import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Star, Diamond, Repeat, IndianRupee, Calendar } from "lucide-react";
import { formatDateIN, formatINR, formatPhoneIN } from "@/lib/format";

export const Route = createFileRoute("/_app/customers/$customerId")({
  component: CustomerProfile,
});

type Customer = {
  id: string; lead_id: string; company_id: string;
  full_name: string; phone: string; email: string | null;
  total_events: number; first_event_date: string | null; last_event_date: string | null;
  lifetime_value: number; avg_rating: number | null; tags: string[];
};
type Booking = {
  id: string; event_date: string; total_amount: number; status: string;
  venue: string | null; lead_id: string;
};

function tagMeta(tag: string) {
  if (tag === "vip") return { label: "VIP", icon: Diamond, cls: "bg-warning/15 text-warning dark:text-warning border-warning/30" };
  if (tag === "promoter") return { label: "Promoter", icon: Star, cls: "bg-success/15 text-success dark:text-success border-success/30" };
  return { label: "Returning", icon: Repeat, cls: "bg-info/15 text-info  border-info/30" };
}

function CustomerProfile() {
  const { customerId } = Route.useParams();
  const navigate = useNavigate();
  const [c, setC] = useState<Customer | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [requirements, setRequirements] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("customers").select("*").eq("id", customerId).maybeSingle();
      if (!data) return;
      setC(data as Customer);
      const { data: b } = await supabase
        .from("bookings")
        .select("id, event_date, total_amount, status, venue, lead_id, requirement_id")
        .eq("lead_id", data.lead_id)
        .is("deleted_at", null)
        .order("event_date", { ascending: false });
      setBookings((b ?? []) as Booking[]);
      const reqIds = (b ?? []).map((x: any) => x.requirement_id).filter(Boolean);
      if (reqIds.length) {
        const { data: rq } = await supabase.from("requirements").select("id, event_type").in("id", reqIds);
        const map: Record<string, string> = {};
        (rq ?? []).forEach((r: any) => { map[r.id] = r.event_type; });
        setRequirements(map);
      }
    })();
  }, [customerId]);

  if (!c) return <div className="p-4 text-sm text-muted-foreground">Loading customer…</div>;

  const firstBooking = bookings[bookings.length - 1];
  const lastBooking = bookings[0];

  return (
    <div className="space-y-4">
      <button onClick={() => navigate({ to: "/leads/$leadId", params: { leadId: c.lead_id } })}
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to lead
      </button>

      <Card className="p-4 md:p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold">{c.full_name}</h1>
            <div className="text-sm text-muted-foreground">{formatPhoneIN(c.phone, false)}{c.email ? ` · ${c.email}` : ""}</div>
            <div className="mt-3 flex gap-2 flex-wrap">
              {c.tags.length === 0 && <Badge variant="secondary">Customer</Badge>}
              {c.tags.map((t) => {
                const m = tagMeta(t); const Icon = m.icon;
                return <span key={t} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${m.cls}`}><Icon className="h-3 w-3" />{m.label}</span>;
              })}
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="text-right">
              <div className="text-muted-foreground text-xs">Total events</div>
              <div className="font-semibold text-lg">{c.total_events}</div>
            </div>
            <div className="text-right">
              <div className="text-muted-foreground text-xs">Lifetime value</div>
              <div className="font-semibold text-lg">{formatINR(Number(c.lifetime_value || 0))}</div>
            </div>
            {c.avg_rating != null && (
              <div className="text-right">
                <div className="text-muted-foreground text-xs">Avg rating</div>
                <div className="font-semibold text-lg inline-flex items-center gap-1">{Number(c.avg_rating).toFixed(1)} <Star className="h-4 w-4 text-warning" /></div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-sm">
          {firstBooking && (
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">First event</div>
              <div className="font-medium">{formatDateIN(firstBooking.event_date)} — {requirements[((firstBooking as any).requirement_id) ?? ""] ?? "Event"}</div>
            </div>
          )}
          {lastBooking && (
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Last event</div>
              <div className="font-medium">{formatDateIN(lastBooking.event_date)} — {requirements[((lastBooking as any).requirement_id) ?? ""] ?? "Event"}</div>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <div className="font-semibold mb-3">All bookings</div>
        <div className="space-y-2">
          {bookings.map((b) => (
            <Link key={b.id} to="/leads/$leadId" params={{ leadId: b.lead_id }}
              className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">{formatDateIN(b.event_date)} · {requirements[((b as any).requirement_id) ?? ""] ?? "Event"}</div>
                  {b.venue && <div className="text-xs text-muted-foreground">{b.venue}</div>}
                </div>
              </div>
              <div className="text-sm flex items-center gap-3">
                <span className="text-xs px-2 py-0.5 rounded-full border bg-muted">{b.status}</span>
                <span className="font-semibold inline-flex items-center"><IndianRupee className="h-3.5 w-3.5" />{Number(b.total_amount).toLocaleString("en-IN")}</span>
              </div>
            </Link>
          ))}
          {bookings.length === 0 && <div className="text-sm text-muted-foreground">No bookings yet.</div>}
        </div>
      </Card>

      <Button variant="outline" onClick={() => navigate({ to: "/leads/$leadId", params: { leadId: c.lead_id } })}>
        Open lead profile
      </Button>
    </div>
  );
}
