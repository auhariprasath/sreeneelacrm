import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { formatDateIN, formatDateTimeIN, formatINR, formatTimeOfDay } from "@/lib/format";
import {
  UserCheck, Briefcase, ListChecks, CheckCircle2, Clock, AlertTriangle,
  CalendarCheck, IndianRupee, Star, Users,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];

interface ExtraDayRow { id: string; day_number: number; label: string | null; event_date: string; start_time: string | null; end_time: string | null }

interface Props {
  leadId: string;
  companyId: string;
  bookings: Booking[];
  assignedTo: string | null;
}

interface StaffInfo { id: string; full_name: string; phone: string | null }
interface VendorRow {
  id: string; vendor_name: string; service_type: string;
  confirmed: boolean; no_show: boolean; rating: number | null;
  amount_agreed: number | null; last_status: string | null;
}
interface TaskRow {
  id: string; title: string; status: string; due_at: string | null;
  assignee_name: string | null; vendor_name: string | null;
}
interface CoordRow { coordinator_name: string | null; last_stage: string | null; stages_done: number; total_stages: number }

const TASK_STATUS_COLOR: Record<string, string> = {
  pending:     "bg-warning/15 text-warning",
  in_progress: "bg-info/15 text-info",
  done:        "bg-success/15 text-success dark:text-success",
  cancelled:   "bg-muted text-muted-foreground",
};

const VENDOR_LIVE_COLOR: Record<string, string> = {
  packed:     "bg-info/15 text-info",
  traveling:  "bg-warning/15 text-warning",
  arrived:    "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  setup_done: "bg-success/15 text-success dark:text-success",
};

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {icon}{title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={`font-medium text-right ${highlight ? "text-success dark:text-success" : ""}`}>{value}</span>
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${ok ? "bg-success" : "bg-warning"}`} />;
}

export function BookingStatusTab({ leadId, companyId, bookings, assignedTo }: Props) {
  const [assignedStaff, setAssignedStaff] = useState<StaffInfo | null>(null);
  const [bookingData, setBookingData] = useState<Record<string, {
    vendors: VendorRow[];
    tasks: TaskRow[];
    coord: CoordRow | null;
    payments: { total: number; paid: number; due: number; pending_count: number };
    confirmation_sent_at: string | null;
    extraDays: ExtraDayRow[];
  }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // Load assigned staff
      if (assignedTo) {
        const { data } = await supabase.from("profiles").select("id, full_name, phone").eq("id", assignedTo).maybeSingle();
        setAssignedStaff((data as any) ?? null);
      } else {
        setAssignedStaff(null);
      }

      if (bookings.length === 0) { setLoading(false); return; }

      const result: typeof bookingData = {};

      await Promise.all(bookings.map(async (b) => {
        const [vendorRes, taskRes, coordRes, payRes, coordUpdRes, daysRes] = await Promise.all([
          supabase.from("booking_vendors").select("id,vendor_id,confirmed,no_show,rating,amount_agreed,amount_paid").eq("booking_id", b.id),
          supabase.from("tasks").select("id,title,status,due_at,assigned_to,vendor_id").eq("booking_id", b.id).is("deleted_at", null).order("due_at", { ascending: true }),
          supabase.from("event_coordination" as any).select("id,coordinator_id").eq("booking_id", b.id).maybeSingle(),
          supabase.from("payments").select("status,amount").eq("booking_id", b.id).is("deleted_at", null),
          supabase.from("vendor_status_updates" as any).select("booking_vendor_id,status").order("updated_at", { ascending: false }),
          supabase.from("booking_days" as any).select("id,day_number,label,event_date,start_time,end_time").eq("booking_id", b.id).order("day_number", { ascending: true }),
        ]);

        // Vendors
        const rawVendors = (vendorRes.data as any[]) ?? [];
        const vendorIds = rawVendors.map((v) => v.vendor_id);
        const vendorInfoMap = new Map<string, { name: string; service_type: string }>();
        if (vendorIds.length) {
          const { data: vInfo } = await supabase.from("vendors").select("id,name,service_type").in("id", vendorIds);
          ((vInfo as any[]) ?? []).forEach((v) => vendorInfoMap.set(v.id, { name: v.name, service_type: v.service_type }));
        }
        const liveStatusMap = new Map<string, string>();
        ((vendorRes.data as any[]) ?? []).forEach((bv) => {
          const ups = ((coordUpdRes.data as any[]) ?? []).filter((u) => u.booking_vendor_id === bv.id);
          if (ups.length) liveStatusMap.set(bv.id, ups[0].status);
        });
        const vendors: VendorRow[] = rawVendors.map((bv) => ({
          id: bv.id,
          vendor_name: vendorInfoMap.get(bv.vendor_id)?.name ?? "Unknown vendor",
          service_type: vendorInfoMap.get(bv.vendor_id)?.service_type ?? "",
          confirmed: bv.confirmed ?? false,
          no_show: bv.no_show ?? false,
          rating: bv.rating ?? null,
          amount_agreed: bv.amount_agreed ?? null,
          last_status: liveStatusMap.get(bv.id) ?? null,
        }));

        // Tasks
        const rawTasks = (taskRes.data as any[]) ?? [];
        const staffIds = Array.from(new Set(rawTasks.map((t) => t.assigned_to).filter(Boolean)));
        const taskVendorIds = Array.from(new Set(rawTasks.map((t) => t.vendor_id).filter(Boolean)));
        const staffNameMap = new Map<string, string>();
        const taskVendorMap = new Map<string, string>();
        if (staffIds.length) {
          const { data: ps } = await supabase.from("profiles").select("id,full_name").in("id", staffIds);
          ((ps as any[]) ?? []).forEach((p) => staffNameMap.set(p.id, p.full_name));
        }
        if (taskVendorIds.length) {
          const { data: vs } = await supabase.from("vendors").select("id,name").in("id", taskVendorIds);
          ((vs as any[]) ?? []).forEach((v) => taskVendorMap.set(v.id, v.name));
        }
        const tasks: TaskRow[] = rawTasks.map((t) => ({
          id: t.id, title: t.title, status: t.status, due_at: t.due_at,
          assignee_name: t.assigned_to ? (staffNameMap.get(t.assigned_to) ?? "—") : null,
          vendor_name: t.vendor_id ? (taskVendorMap.get(t.vendor_id) ?? null) : null,
        }));

        // Coordination
        let coord: CoordRow | null = null;
        const coordData = (coordRes.data as any);
        if (coordData?.id) {
          const { data: coordUpdates } = await supabase
            .from("event_coordination_updates" as any)
            .select("stage")
            .eq("coordination_id", coordData.id);
          const { data: whoData } = await supabase.from("profiles").select("full_name").eq("id", coordData.coordinator_id).maybeSingle();
          const stages = (coordUpdates as any[]) ?? [];
          coord = {
            coordinator_name: (whoData as any)?.full_name ?? null,
            last_stage: stages.length ? stages[stages.length - 1].stage : null,
            stages_done: stages.length,
            total_stages: 7,
          };
        }

        // Payments
        const rawPay = (payRes.data as any[]) ?? [];
        const pending_count = rawPay.filter((p) => p.status === "pending").length;
        result[b.id] = {
          vendors,
          tasks,
          coord,
          payments: {
            total: Number(b.total_amount ?? 0),
            paid: Number(b.amount_paid ?? 0),
            due: Number(b.balance_due ?? 0),
            pending_count,
          },
          confirmation_sent_at: (b as any).confirmation_sent_at ?? null,
          extraDays: ((daysRes.data as unknown) as ExtraDayRow[]) ?? [],
        };
      }));

      setBookingData(result);
      setLoading(false);
    })();
  }, [leadId, companyId, bookings, assignedTo]);

  if (loading) {
    return <div className="py-8 text-sm text-muted-foreground text-center">Loading…</div>;
  }

  return (
    <div className="pt-3 space-y-4">

      {/* Assigned staff — always shown */}
      <Section title="Assigned Staff" icon={<UserCheck className="h-3.5 w-3.5" />}>
        {assignedStaff ? (
          <div className="flex items-center gap-2 text-sm">
            <StatusDot ok={true} />
            <span className="font-medium">{assignedStaff.full_name}</span>
            {assignedStaff.phone && <span className="text-muted-foreground text-xs">· {assignedStaff.phone}</span>}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-warning dark:text-warning">
            <StatusDot ok={false} />
            <span>No staff assigned yet</span>
          </div>
        )}
      </Section>

      {bookings.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6 border rounded-lg bg-card">
          No bookings confirmed yet. Bookings appear here after a quotation is agreed and confirmed.
        </div>
      ) : (
        bookings.map((b) => {
          const bd = bookingData[b.id];
          if (!bd) return null;
          const allVendorsConfirmed = bd.vendors.length > 0 && bd.vendors.every((v) => v.confirmed);
          const pendingTasks = bd.tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
          const doneTasks = bd.tasks.filter((t) => t.status === "done");

          return (
            <div key={b.id} className="space-y-3">
              {/* Booking header */}
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CalendarCheck className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">{formatDateIN(b.event_date)}</span>
                      {b.start_time && <span className="text-xs text-muted-foreground">· {formatTimeOfDay(b.start_time)}</span>}
                      <span className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5
                        ${b.status === "confirmed" ? "bg-success/15 text-success dark:text-success"
                          : b.status === "cancelled" ? "bg-destructive/15 text-destructive"
                          : "bg-warning/15 text-warning"}`}>
                        {b.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    {b.venue && <div className="text-xs text-muted-foreground mt-0.5">{b.venue}</div>}
                    {bd.extraDays.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {bd.extraDays.map((d) => (
                          <div key={d.id} className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <span className="font-medium text-foreground">{d.label ?? `Day ${d.day_number}`}:</span>
                            {formatDateIN(d.event_date)}
                            {d.start_time && ` · ${formatTimeOfDay(d.start_time)}`}
                            {d.end_time && ` – ${formatTimeOfDay(d.end_time)}`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-xs space-y-0.5">
                    <div className="text-muted-foreground">Confirmation</div>
                    {bd.confirmation_sent_at ? (
                      <div className="text-success dark:text-success flex items-center gap-1 justify-end">
                        <CheckCircle2 className="h-3 w-3" /> Sent {formatDateTimeIN(bd.confirmation_sent_at)}
                      </div>
                    ) : (
                      <div className="text-warning dark:text-warning flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3" /> Not sent yet
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Payments */}
              <Section title="Payment Status" icon={<IndianRupee className="h-3.5 w-3.5" />}>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><div className="text-muted-foreground">Total</div><div className="font-semibold">{formatINR(bd.payments.total)}</div></div>
                  <div><div className="text-muted-foreground">Paid</div><div className="font-semibold text-success dark:text-success">{formatINR(bd.payments.paid)}</div></div>
                  <div><div className="text-muted-foreground">Due</div><div className={`font-semibold ${bd.payments.due > 0 ? "text-destructive" : "text-success dark:text-success"}`}>{formatINR(bd.payments.due)}</div></div>
                </div>
                {bd.payments.pending_count > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-warning dark:text-warning">
                    <AlertTriangle className="h-3 w-3" /> {bd.payments.pending_count} pending payment{bd.payments.pending_count > 1 ? "s" : ""} awaiting review
                  </div>
                )}
              </Section>

              {/* Coordinator */}
              {bd.coord && (
                <Section title="Coordinator" icon={<Users className="h-3.5 w-3.5" />}>
                  <Row label="Assigned" value={bd.coord.coordinator_name ?? "—"} />
                  <Row label="Progress"
                    value={
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 rounded-full bg-muted overflow-hidden w-24">
                          <div className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${(bd.coord.stages_done / bd.coord.total_stages) * 100}%` }} />
                        </div>
                        <span className="text-xs">{bd.coord.stages_done}/{bd.coord.total_stages} stages</span>
                      </div>
                    }
                  />
                  {bd.coord.last_stage && (
                    <Row label="Last stage" value={<span className="capitalize">{bd.coord.last_stage.replace(/_/g, " ")}</span>} />
                  )}
                </Section>
              )}

              {/* Vendors */}
              {bd.vendors.length > 0 && (
                <Section title={`Vendors (${bd.vendors.length})`} icon={<Briefcase className="h-3.5 w-3.5" />}>
                  {!allVendorsConfirmed && (
                    <div className="flex items-center gap-1.5 text-xs text-warning dark:text-warning mb-1">
                      <AlertTriangle className="h-3 w-3" />
                      {bd.vendors.filter((v) => !v.confirmed && !v.no_show).length} vendor(s) not yet confirmed
                    </div>
                  )}
                  <div className="space-y-2">
                    {bd.vendors.map((v) => (
                      <div key={v.id} className="flex items-start justify-between gap-2 text-sm border-b last:border-0 pb-2 last:pb-0">
                        <div className="flex items-start gap-2 min-w-0">
                          <StatusDot ok={v.confirmed && !v.no_show} />
                          <div className="min-w-0">
                            <div className="font-medium text-xs truncate">{v.vendor_name}</div>
                            <div className="text-[11px] text-muted-foreground">{v.service_type}</div>
                            {v.amount_agreed != null && (
                              <div className="text-[11px] text-muted-foreground">{formatINR(v.amount_agreed)}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {v.no_show ? (
                            <Badge variant="destructive" className="text-[10px] gap-0.5 h-4 px-1.5">
                              <AlertTriangle className="h-2.5 w-2.5" /> No-show
                            </Badge>
                          ) : v.confirmed ? (
                            <Badge variant="outline" className="text-[10px] gap-0.5 h-4 px-1.5 bg-success/10 text-success border-success/30">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Confirmed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] gap-0.5 h-4 px-1.5 bg-warning/10 text-warning border-warning/30">
                              <Clock className="h-2.5 w-2.5" /> Pending
                            </Badge>
                          )}
                          {v.last_status && (
                            <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-medium ${VENDOR_LIVE_COLOR[v.last_status] ?? "bg-muted text-muted-foreground"}`}>
                              {v.last_status.replace("_", " ")}
                            </span>
                          )}
                          {v.rating != null && (
                            <span className="flex items-center gap-0.5 text-[10px] text-warning">
                              <Star className="h-2.5 w-2.5 fill-warning" /> {Number(v.rating).toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Tasks */}
              {bd.tasks.length > 0 && (
                <Section title={`Tasks (${doneTasks.length}/${bd.tasks.length} done)`} icon={<ListChecks className="h-3.5 w-3.5" />}>
                  {pendingTasks.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-warning dark:text-warning mb-1">
                      <Clock className="h-3 w-3" /> {pendingTasks.length} pending task{pendingTasks.length > 1 ? "s" : ""}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {bd.tasks.map((t) => (
                      <div key={t.id} className="flex items-start justify-between gap-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <StatusDot ok={t.status === "done"} />
                            <span className="font-medium truncate">{t.title}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground ml-3.5">
                            {t.assignee_name ?? (t.vendor_name ? `Vendor: ${t.vendor_name}` : "Unassigned")}
                            {t.due_at && <> · due {formatDateIN(t.due_at)}</>}
                          </div>
                        </div>
                        <span className={`text-[10px] rounded-full px-1.5 py-0.5 shrink-0 ${TASK_STATUS_COLOR[t.status] ?? "bg-muted text-muted-foreground"}`}>
                          {t.status.replace("_", " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
