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
import { DateConfirmField } from "@/components/ui/date-confirm-field";
import { FileText, Search, Download, ExternalLink } from "lucide-react";
import { InvoiceRowMenu } from "@/components/quotations/invoice-row-menu";

export const Route = createFileRoute("/_app/quotations")({ component: QuotationsPage });

type Status = "all" | "draft" | "sent" | "agreed" | "revised" | "declined";

interface QuotationRow {
  id: string;
  lead_id: string;
  company_id: string;
  requirement_id: string | null;
  version: number;
  total: number;
  status: string;
  sent_at: string | null;
  created_at: string;
  is_peak_season: boolean;
  pdf_url: string | null;
  lead?: { full_name: string; phone: string } | null;
  company?: { name: string } | null;
  requirement?: { event_date: string | null; event_type: string | null; requirement_number: number } | null;
}

function statusColor(s: string) {
  return s === "agreed"
    ? "bg-success/15 text-success dark:text-success"
    : s === "sent"
    ? "bg-info/15 text-info"
    : s === "declined"
    ? "bg-destructive/15 text-destructive dark:text-destructive"
    : s === "revised"
    ? "bg-warning/15 text-warning dark:text-warning"
    : "bg-muted text-muted-foreground";
}

function statusLabel(s: string) {
  if (s === "agreed") return "Approved";
  if (s === "revised") return "Revised";
  if (s === "declined") return "Declined";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function QuotationsPage() {
  const { role, companies, activeCompanyId } = useAuth();
  const [status, setStatus] = useState<Status>("all");
  const [companyId, setCompanyId] = useState<string>("all");
  const [range, setRange] = useState<"week" | "month" | "quarter" | "custom">("month");
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [versionFilter, setVersionFilter] = useState<string>("all");
  const [rows, setRows] = useState<QuotationRow[]>([]);
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
    } else if (range === "quarter") {
      setFrom(new Date(today.getTime() - 90 * 86400_000).toISOString().slice(0, 10));
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
      let q = supabase
        .from("quotations")
        .select("id,lead_id,company_id,version,total,status,sent_at,created_at,is_peak_season,pdf_url,requirement_id")
        .is("deleted_at", null)
        .gte("created_at", new Date(from).toISOString())
        .lte("created_at", new Date(new Date(to).getTime() + 86400_000).toISOString())
        .order("created_at", { ascending: false })
        .limit(400);
      if (effectiveCompanyId) q = q.eq("company_id", effectiveCompanyId);
      if (status !== "all") q = q.eq("status", status);
      const { data } = await q;
      const base = (data as any[]) ?? [];
      const leadIds = [...new Set(base.map((r) => r.lead_id))];
      const compIds = [...new Set(base.map((r) => r.company_id))];
      const reqIds = [...new Set(base.map((r) => r.requirement_id).filter(Boolean))];
      const [{ data: leads }, { data: comps }, { data: reqs }] = await Promise.all([
        leadIds.length
          ? supabase.from("leads").select("id,full_name,phone").in("id", leadIds)
          : Promise.resolve({ data: [] as any[] }),
        compIds.length
          ? supabase.from("companies").select("id,name").in("id", compIds)
          : Promise.resolve({ data: [] as any[] }),
        reqIds.length
          ? supabase.from("requirements").select("id,event_date,event_type,requirement_number").in("id", reqIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const ml = new Map((leads ?? []).map((l: any) => [l.id, l]));
      const mc = new Map((comps ?? []).map((c: any) => [c.id, c]));
      const mr = new Map((reqs ?? []).map((r: any) => [r.id, r]));
      const merged: QuotationRow[] = base.map((r) => ({
        ...r,
        lead: ml.get(r.lead_id) ?? null,
        company: mc.get(r.company_id) ?? null,
        requirement: mr.get(r.requirement_id) ?? null,
      }));
      if (!cancelled) { setRows(merged); setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, [effectiveCompanyId, status, from, to, reloadKey]);

  useDashboardRealtime(["quotations"], refresh);

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (s && !(r.lead?.full_name ?? "").toLowerCase().includes(s) && !(r.lead?.phone ?? "").includes(s)) return false;
      if (versionFilter !== "all") {
        if (versionFilter === "1" && r.version !== 1) return false;
        if (versionFilter === "2" && r.version !== 2) return false;
        if (versionFilter === "3+" && r.version < 3) return false;
      }
      return true;
    });
  }, [rows, search, versionFilter]);

  const exportCsv = () => {
    const headers = ["Lead", "Phone", "Company", "Event date", "Event type", "R/V", "Status", "Total", "Sent at"];
    const lines = [headers.join(",")];
    filteredRows.forEach((r) => {
      const rn = r.requirement?.requirement_number ?? 1;
      lines.push([
        r.lead?.full_name ?? "",
        r.lead?.phone ?? "",
        r.company?.name ?? "",
        r.requirement?.event_date ?? "",
        r.requirement?.event_type ?? "",
        `R${rn} V${r.version}`,
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
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" /> All Quotations
          </h1>
          <p className="text-sm text-muted-foreground">
            {busy ? "Loading…" : `${filteredRows.length} quotation${filteredRows.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {canExport && (
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filteredRows.length}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 md:p-4 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search lead name or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="agreed">Approved</SelectItem>
              <SelectItem value="revised">Revised</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
            </SelectContent>
          </Select>

          <Select value={versionFilter} onValueChange={setVersionFilter}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Version" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All versions</SelectItem>
              <SelectItem value="1">V1 only</SelectItem>
              <SelectItem value="2">V2 only</SelectItem>
              <SelectItem value="3+">V3 and above</SelectItem>
            </SelectContent>
          </Select>

          {role === "super_admin" && !activeCompanyId && (
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Company" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <Select value={range} onValueChange={(v) => setRange(v as any)}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="quarter">Last 3 months</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          {range === "custom" && (
            <>
              <DateConfirmField value={from} onChange={setFrom} placeholder="From date" />
              <DateConfirmField value={to} onChange={setTo} placeholder="To date" />
            </>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      {busy ? (
        <SkeletonList rows={6} />
      ) : filteredRows.length === 0 ? (
        <div className="text-sm text-muted-foreground py-12 text-center">No quotations match the filters.</div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Lead</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Company</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Event</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">R/V</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Total</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Sent / Created</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const rn = r.requirement?.requirement_number ?? 1;
                const eventLabel = [r.requirement?.event_type, r.requirement?.event_date ? formatDateIN(r.requirement.event_date) : null]
                  .filter(Boolean).join(" · ");
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      <Link to="/leads/$leadId" params={{ leadId: r.lead_id }} className="hover:underline text-foreground">
                        {r.lead?.full_name ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {r.lead?.phone ? formatPhoneIN(r.lead.phone, false) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.company?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{eventLabel || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[11px] font-semibold bg-primary/10 text-primary rounded px-1.5 py-0.5">R{rn}</span>
                        <span className="text-[11px] font-semibold bg-muted text-muted-foreground rounded px-1.5 py-0.5">V{r.version}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge className={statusColor(r.status)}>{statusLabel(r.status)}</Badge>
                      {r.is_peak_season && (
                        <span className="ml-1.5 text-[10px] text-warning dark:text-warning font-medium">Peak</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{formatINR(Number(r.total))}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                      {r.sent_at ? `Sent ${relativeTime(r.sent_at)}` : `Created ${relativeTime(r.created_at)}`}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          to="/leads/$leadId"
                          params={{ leadId: r.lead_id }}
                          className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span className="hidden sm:inline">Open</span>
                        </Link>
                        <InvoiceRowMenu
                          quotationId={r.id}
                          leadId={r.lead_id}
                          pdfUrl={r.pdf_url}
                          versionLabel={`R${rn} V${r.version}`}
                          onDeleted={refresh}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
