import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardRealtime } from "@/hooks/use-dashboard-realtime";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SkeletonList } from "@/components/skeleton-list";
import { formatINR, formatDateIN, formatPhoneIN, relativeTime } from "@/lib/format";
import { FileText, Search, Download, ExternalLink } from "lucide-react";
import { InvoiceRowMenu } from "@/components/quotations/invoice-row-menu";

export const Route = createFileRoute("/_app/quotations")({ component: QuotationsPage });

type Status = "all" | "draft" | "sent" | "agreed" | "revised" | "declined";

interface Row {
  id: string;
  lead_id: string;
  company_id: string;
  version: number;
  total: number;
  status: string;
  sent_at: string | null;
  created_at: string;
  is_peak_season: boolean;
  pdf_url: string | null;
  lead?: { full_name: string; phone: string } | null;
  company?: { name: string } | null;
  requirement?: { event_date: string | null; event_type: string | null } | null;
}

function statusColor(s: string) {
  return s === "agreed" ? "bg-success/15 text-success dark:text-success"
    : s === "sent" ? "bg-info/15 text-info "
    : s === "declined" ? "bg-destructive/15 text-destructive dark:text-destructive"
    : s === "revised" ? "bg-warning/15 text-warning dark:text-warning"
    : "bg-muted text-muted-foreground";
}

function QuotationsPage() {
  const { role, companies, activeCompanyId } = useAuth();
  const [status, setStatus] = useState<Status>("all");
  const [companyId, setCompanyId] = useState<string>("all");
  const [range, setRange] = useState<"week" | "month" | "custom">("month");
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    const today = new Date();
    if (range === "week") {
      setFrom(new Date(today.getTime() - 7 * 86400_000).toISOString().slice(0, 10));
      setTo(today.toISOString().slice(0, 10));
    } else if (range === "month") {
      setFrom(new Date(today.getTime() - 30 * 86400_000).toISOString().slice(0, 10));
      setTo(today.toISOString().slice(0, 10));
    }
  }, [range]);

  const effectiveCompanyId = role === "super_admin"
    ? (companyId === "all" ? activeCompanyId : companyId)
    : companies[0]?.id ?? null;

  useEffect(() => {
    if (role === "super_admin") setCompanyId(activeCompanyId ?? "all");
  }, [role, activeCompanyId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      let q = supabase.from("quotations")
        .select("id,lead_id,company_id,version,total,status,sent_at,created_at,is_peak_season,pdf_url,requirement_id")
        .is("deleted_at", null)
        .gte("created_at", new Date(from).toISOString())
        .lte("created_at", new Date(new Date(to).getTime() + 86400_000).toISOString())
        .order("created_at", { ascending: false })
        .limit(200);
      if (effectiveCompanyId) q = q.eq("company_id", effectiveCompanyId);
      if (status !== "all") q = q.eq("status", status);
      const { data } = await q;
      const base = (data as any[]) ?? [];
      const leadIds = [...new Set(base.map((r) => r.lead_id))];
      const compIds = [...new Set(base.map((r) => r.company_id))];
      const reqIds = [...new Set(base.map((r) => r.requirement_id).filter(Boolean))];
      const [{ data: leads }, { data: comps }, { data: reqs }] = await Promise.all([
        leadIds.length ? supabase.from("leads").select("id,full_name,phone").in("id", leadIds) : Promise.resolve({ data: [] as any[] }),
        compIds.length ? supabase.from("companies").select("id,name").in("id", compIds) : Promise.resolve({ data: [] as any[] }),
        reqIds.length ? supabase.from("requirements").select("id,event_date,event_type").in("id", reqIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const ml = new Map((leads ?? []).map((l: any) => [l.id, l]));
      const mc = new Map((comps ?? []).map((c: any) => [c.id, c]));
      const mr = new Map((reqs ?? []).map((r: any) => [r.id, r]));
      const merged: Row[] = base.map((r) => ({
        ...r,
        lead: ml.get(r.lead_id) ?? null,
        company: mc.get(r.company_id) ?? null,
        requirement: mr.get(r.requirement_id) ?? null,
      }));
      if (!cancelled) { setRows(merged); setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, [effectiveCompanyId, status, from, to, reloadKey]);

  // Live updates whenever a quotation in scope is created / sent / approved / expired.
  useDashboardRealtime(["quotations"], refresh);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      (r.lead?.full_name ?? "").toLowerCase().includes(s) ||
      (r.lead?.phone ?? "").includes(s)
    );
  }, [rows, search]);

  const exportCsv = () => {
    const headers = ["Lead", "Phone", "Company", "Event date", "Event type", "Version", "Status", "Total", "Sent at"];
    const lines = [headers.join(",")];
    filtered.forEach((r) => {
      lines.push([
        r.lead?.full_name ?? "",
        r.lead?.phone ?? "",
        r.company?.name ?? "",
        r.requirement?.event_date ?? "",
        r.requirement?.event_type ?? "",
        `v${r.version}`,
        r.status,
        r.total,
        r.sent_at ?? "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `quotations-${from}-${to}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const canExport = role === "super_admin" || role === "admin";

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><FileText className="h-5 w-5" /> All Quotations</h1>
          <p className="text-sm text-muted-foreground">Browse, filter, and export quotations across leads.</p>
        </div>
        {canExport && (
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-3 md:p-4 grid grid-cols-2 md:grid-cols-5 gap-2">
          <div className="col-span-2 md:col-span-2 relative">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search by lead name or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="agreed">Agreed</SelectItem>
              <SelectItem value="revised">Revised</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
            </SelectContent>
          </Select>
          {role === "super_admin" && !activeCompanyId && (
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="Company" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={range} onValueChange={(v) => setRange(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {range === "custom" && (
            <>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </>
          )}
        </CardContent>
      </Card>

      {busy ? <SkeletonList rows={6} /> : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground py-12 text-center">No quotations match the filters.</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Link to="/leads/$leadId" params={{ leadId: r.lead_id }} className="text-sm font-medium hover:underline truncate">{r.lead?.full_name ?? "—"}</Link>
                    <div className="flex items-center gap-1">
                      <Badge className={statusColor(r.status)}>{r.status}</Badge>
                      <InvoiceRowMenu
                        quotationId={r.id}
                        leadId={r.lead_id}
                        pdfUrl={r.pdf_url}
                        versionLabel={`v${r.version}`}
                        onDeleted={refresh}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{formatPhoneIN(r.lead?.phone ?? "", false)}</div>
                  <div className="text-xs flex items-center justify-between">
                    <span>{r.requirement?.event_date ? formatDateIN(r.requirement.event_date) : "—"} · {r.requirement?.event_type ?? ""}</span>
                    <span className="font-semibold">{formatINR(Number(r.total))}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">v{r.version} · {r.company?.name ?? ""} · {r.sent_at ? `Sent ${relativeTime(r.sent_at)}` : relativeTime(r.created_at)}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Lead</th>
                      <th className="text-left p-3">Company</th>
                      <th className="text-left p-3">Event</th>
                      <th className="text-right p-3">Total</th>
                      <th className="text-center p-3">Version</th>
                      <th className="text-center p-3">Status</th>
                      <th className="text-left p-3">Sent</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="p-3">
                          <div className="font-medium">{r.lead?.full_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{formatPhoneIN(r.lead?.phone ?? "", false)}</div>
                        </td>
                        <td className="p-3">{r.company?.name ?? "—"}</td>
                        <td className="p-3">
                          <div>{r.requirement?.event_date ? formatDateIN(r.requirement.event_date) : "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.requirement?.event_type ?? ""}</div>
                        </td>
                        <td className="p-3 text-right font-semibold">{formatINR(Number(r.total))}</td>
                        <td className="p-3 text-center text-xs">v{r.version}</td>
                        <td className="p-3 text-center"><Badge className={statusColor(r.status)}>{r.status}</Badge></td>
                        <td className="p-3 text-xs text-muted-foreground">{r.sent_at ? formatDateIN(r.sent_at) : "—"}</td>
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Link to="/leads/$leadId" params={{ leadId: r.lead_id }} className="text-primary hover:underline inline-flex items-center gap-1 text-xs">
                              Open lead <ExternalLink className="h-3 w-3" />
                            </Link>
                            <InvoiceRowMenu
                              quotationId={r.id}
                              leadId={r.lead_id}
                              pdfUrl={r.pdf_url}
                              versionLabel={`v${r.version}`}
                              onDeleted={refresh}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
