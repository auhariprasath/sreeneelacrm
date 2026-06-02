import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DashboardSkeleton } from "@/components/skeleton-dashboard";
import { formatINR, formatDateIN } from "@/lib/format";
import { toast } from "sonner";
import { Building2, Gift, Activity, Users, XCircle, Lightbulb, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_app/command-centre")({
  beforeLoad: ({ context }) => {
    // gate at runtime via component; layout already auth-gates
    return context;
  },
  component: CommandCentrePage,
});

interface CompanyRow {
  id: string;
  name: string;
  leads: number;
  bookings: number;
  revenue: number;
  conversionPct: number;
  avgRating: number;
}

interface LoginRow {
  id: string;
  user_id: string;
  login_at: string;
  logout_at: string | null;
  device_type: string | null;
  full_name: string;
  email: string;
}

interface ReferralRow {
  id: string;
  referrer_lead_id: string;
  benefit_sent: boolean;
  benefit_sent_at: string | null;
  notes: string | null;
  referrer_name: string;
  refer_count: number;
}

interface NotInterestedRow {
  lead_id: string;
  full_name: string;
  phone: string | null;
  company_id: string;
  company_name: string;
  drop_reason: string | null;
  closed_at: string;
}

function CommandCentrePage() {
  const { role, loading } = useAuth();
  const [companyStats, setCompanyStats] = useState<CompanyRow[] | null>(null);
  const [logins, setLogins] = useState<LoginRow[] | null>(null);
  const [referrals, setReferrals] = useState<ReferralRow[] | null>(null);
  const [notInterested, setNotInterested] = useState<NotInterestedRow[] | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (role !== "super_admin") return;
    let cancelled = false;
    setBusy(true);
    (async () => {
      const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
      const [companiesRes, leadsRes, bookingsRes, wlRes, fbRes, loginRes, profilesRes, refRes, allLeadsRes, lostRes] = await Promise.all([
        supabase.from("companies").select("id, name").is("deleted_at", null).order("name"),
        supabase.from("leads").select("company_id").is("deleted_at", null),
        supabase.from("bookings").select("company_id, total_amount, status").is("deleted_at", null),
        supabase.from("win_loss_log").select("company_id, outcome"),
        supabase.from("feedback").select("company_id, rating"),
        supabase.from("login_log").select("id, user_id, login_at, logout_at, device_type")
          .gte("login_at", since30).order("login_at", { ascending: false }).limit(100),
        supabase.from("profiles").select("id, full_name, email"),
        supabase.from("referral_loyalty_flags").select("id, referrer_lead_id, benefit_sent, benefit_sent_at, notes, flagged_by, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("leads").select("id, full_name, referred_by_lead_id").is("deleted_at", null),
        supabase.from("win_loss_log")
          .select("lead_id, company_id, drop_reason, created_at, lead:leads(full_name, phone)")
          .eq("outcome", "lost")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      if (cancelled) return;

      const companies = (companiesRes.data ?? []) as Array<{ id: string; name: string }>;
      const leadsByCompany = new Map<string, number>();
      (leadsRes.data ?? []).forEach((l: any) => leadsByCompany.set(l.company_id, (leadsByCompany.get(l.company_id) ?? 0) + 1));
      const bookingAgg = new Map<string, { count: number; revenue: number }>();
      (bookingsRes.data ?? []).forEach((b: any) => {
        if (b.status === "cancelled") return;
        const cur = bookingAgg.get(b.company_id) ?? { count: 0, revenue: 0 };
        cur.count += 1; cur.revenue += Number(b.total_amount || 0);
        bookingAgg.set(b.company_id, cur);
      });
      const wlAgg = new Map<string, { won: number; lost: number }>();
      (wlRes.data ?? []).forEach((r: any) => {
        const cur = wlAgg.get(r.company_id) ?? { won: 0, lost: 0 };
        if (r.outcome === "won") cur.won += 1; else cur.lost += 1;
        wlAgg.set(r.company_id, cur);
      });
      const fbAgg = new Map<string, { sum: number; count: number }>();
      (fbRes.data ?? []).forEach((r: any) => {
        const cur = fbAgg.get(r.company_id) ?? { sum: 0, count: 0 };
        cur.sum += r.rating; cur.count += 1;
        fbAgg.set(r.company_id, cur);
      });

      setCompanyStats(companies.map((c) => {
        const wl = wlAgg.get(c.id);
        const total = wl ? wl.won + wl.lost : 0;
        const fb = fbAgg.get(c.id);
        const bk = bookingAgg.get(c.id);
        return {
          id: c.id, name: c.name,
          leads: leadsByCompany.get(c.id) ?? 0,
          bookings: bk?.count ?? 0,
          revenue: bk?.revenue ?? 0,
          conversionPct: total ? Math.round(((wl?.won ?? 0) / total) * 100) : 0,
          avgRating: fb && fb.count ? fb.sum / fb.count : 0,
        };
      }));

      const profileMap = new Map<string, { full_name: string; email: string }>();
      (profilesRes.data ?? []).forEach((p: any) => profileMap.set(p.id, { full_name: p.full_name, email: p.email }));
      setLogins((loginRes.data ?? []).map((l: any) => {
        const p = profileMap.get(l.user_id);
        return { ...l, full_name: p?.full_name ?? "—", email: p?.email ?? "—" };
      }));

      const allLeads = (allLeadsRes.data ?? []) as Array<{ id: string; full_name: string; referred_by_lead_id: string | null }>;
      const leadById = new Map(allLeads.map((l) => [l.id, l.full_name]));
      const refCount = new Map<string, number>();
      allLeads.forEach((l) => {
        if (l.referred_by_lead_id) refCount.set(l.referred_by_lead_id, (refCount.get(l.referred_by_lead_id) ?? 0) + 1);
      });
      // Also include auto-generated rows: leads that have ≥2 referrals but no flag yet
      const flagged = new Set((refRes.data ?? []).map((r: any) => r.referrer_lead_id));
      const autoRows: ReferralRow[] = [];
      refCount.forEach((count, leadId) => {
        if (count >= 2 && !flagged.has(leadId)) {
          autoRows.push({
            id: `auto-${leadId}`, referrer_lead_id: leadId,
            benefit_sent: false, benefit_sent_at: null, notes: null,
            referrer_name: leadById.get(leadId) ?? "—", refer_count: count,
          });
        }
      });
      const flagRows: ReferralRow[] = (refRes.data ?? []).map((r: any) => ({
        id: r.id, referrer_lead_id: r.referrer_lead_id,
        benefit_sent: r.benefit_sent, benefit_sent_at: r.benefit_sent_at, notes: r.notes,
        referrer_name: leadById.get(r.referrer_lead_id) ?? "—",
        refer_count: refCount.get(r.referrer_lead_id) ?? 0,
      }));
      setReferrals([...flagRows, ...autoRows].sort((a, b) => b.refer_count - a.refer_count));

      const companyNameMap = new Map(companies.map((c) => [c.id, c.name]));
      setNotInterested(((lostRes.data ?? []) as any[]).map((r) => ({
        lead_id: r.lead_id,
        full_name: r.lead?.full_name ?? "—",
        phone: r.lead?.phone ?? null,
        company_id: r.company_id,
        company_name: companyNameMap.get(r.company_id) ?? "—",
        drop_reason: r.drop_reason ?? null,
        closed_at: r.created_at,
      })));

      setBusy(false);
    })();
    return () => { cancelled = true; };
  }, [role, loading]);

  if (loading) return <DashboardSkeleton />;
  if (role !== "super_admin") {
    return (
      <div className="max-w-7xl space-y-2">
        <h1 className="text-2xl font-semibold">Command Centre</h1>
        <p className="text-sm text-muted-foreground">This page is for Super Admins only.</p>
      </div>
    );
  }

  const markBenefitSent = async (row: ReferralRow) => {
    try {
      if (row.id.startsWith("auto-")) {
        const { error } = await supabase.from("referral_loyalty_flags").insert({
          referrer_lead_id: row.referrer_lead_id,
          benefit_sent: true,
          benefit_sent_at: new Date().toISOString(),
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("referral_loyalty_flags")
          .update({ benefit_sent: true, benefit_sent_at: new Date().toISOString() })
          .eq("id", row.id);
        if (error) throw error;
      }
      setReferrals((prev) => prev?.map((r) => r.referrer_lead_id === row.referrer_lead_id
        ? { ...r, benefit_sent: true, benefit_sent_at: new Date().toISOString() } : r) ?? null);
      toast.success("Benefit marked as sent");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update");
    }
  };

  const totals = companyStats?.reduce((acc, c) => ({
    leads: acc.leads + c.leads,
    bookings: acc.bookings + c.bookings,
    revenue: acc.revenue + c.revenue,
  }), { leads: 0, bookings: 0, revenue: 0 }) ?? { leads: 0, bookings: 0, revenue: 0 };

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold">Super Admin Command Centre</h1>
        <p className="text-sm text-muted-foreground">Cross-company analytics, session audit, and referral loyalty</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview"><Building2 className="h-4 w-4 mr-2" />Companies</TabsTrigger>
          <TabsTrigger value="sessions"><Activity className="h-4 w-4 mr-2" />Sessions</TabsTrigger>
          <TabsTrigger value="referrals"><Gift className="h-4 w-4 mr-2" />Referrals</TabsTrigger>
          <TabsTrigger value="not_interested"><XCircle className="h-4 w-4 mr-2" />Not interested</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {busy || !companyStats ? <DashboardSkeleton /> : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card><CardContent className="p-5">
                  <div className="text-xs uppercase text-muted-foreground">Companies</div>
                  <div className="text-2xl font-semibold mt-1">{companyStats.length}</div>
                </CardContent></Card>
                <Card><CardContent className="p-5">
                  <div className="text-xs uppercase text-muted-foreground">Total leads</div>
                  <div className="text-2xl font-semibold mt-1">{totals.leads}</div>
                </CardContent></Card>
                <Card><CardContent className="p-5">
                  <div className="text-xs uppercase text-muted-foreground">Total bookings</div>
                  <div className="text-2xl font-semibold mt-1">{totals.bookings}</div>
                </CardContent></Card>
                <Card><CardContent className="p-5">
                  <div className="text-xs uppercase text-muted-foreground">Total revenue</div>
                  <div className="text-2xl font-semibold mt-1">{formatINR(totals.revenue)}</div>
                </CardContent></Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Per-company performance</CardTitle>
                  <CardDescription>Ranked by booking revenue</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Bookings</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Conv %</TableHead>
                        <TableHead className="text-right">Rating</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companyStats.slice().sort((a, b) => b.revenue - a.revenue).map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-right">{c.leads}</TableCell>
                          <TableCell className="text-right">{c.bookings}</TableCell>
                          <TableCell className="text-right">{formatINR(c.revenue)}</TableCell>
                          <TableCell className="text-right">{c.conversionPct}%</TableCell>
                          <TableCell className="text-right">{c.avgRating > 0 ? c.avgRating.toFixed(1) : "—"}</TableCell>
                        </TableRow>
                      ))}
                      {companyStats.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No companies yet</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent sessions (last 30 days)</CardTitle>
              <CardDescription>Latest 100 logins across all staff</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!logins ? <div className="p-6"><DashboardSkeleton /></div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Login</TableHead>
                      <TableHead>Logout</TableHead>
                      <TableHead>Device</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logins.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <div className="font-medium">{l.full_name}</div>
                          <div className="text-xs text-muted-foreground">{l.email}</div>
                        </TableCell>
                        <TableCell className="text-xs">{formatDateIN(l.login_at)} {new Date(l.login_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                        <TableCell className="text-xs">{l.logout_at ? `${formatDateIN(l.logout_at)} ${new Date(l.logout_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : <span className="text-muted-foreground">Active</span>}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{l.device_type ?? "unknown"}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {logins.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No recent sessions</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referrals" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top referrers</CardTitle>
              <CardDescription>Leads with 2+ referrals · mark when loyalty benefit has been sent</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!referrals ? <div className="p-6"><DashboardSkeleton /></div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referrer</TableHead>
                      <TableHead className="text-right">Referrals</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrals.filter((r) => r.refer_count > 0).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.referrer_name}</TableCell>
                        <TableCell className="text-right"><Users className="h-3 w-3 inline mr-1" />{r.refer_count}</TableCell>
                        <TableCell>
                          {r.benefit_sent ? (
                            <Badge className="bg-emerald-600">Sent {r.benefit_sent_at ? formatDateIN(r.benefit_sent_at) : ""}</Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!r.benefit_sent && (
                            <Button size="sm" variant="outline" onClick={() => markBenefitSent(r)}>Mark sent</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {referrals.filter((r) => r.refer_count > 0).length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No qualifying referrers yet</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
