import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Star, Diamond, Repeat, Download, Users } from "lucide-react";
import { formatDateIN, formatINR, formatPhoneIN } from "@/lib/format";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/customers")({
  component: CustomersPage,
});

type Row = {
  id: string; lead_id: string; company_id: string;
  full_name: string; phone: string;
  total_events: number; lifetime_value: number;
  avg_rating: number | null; tags: string[];
  last_event_date: string | null; first_event_date: string | null;
};
type Company = { id: string; name: string };

function CustomersPage() {
  const { role } = useAuth();
  if (role !== "super_admin") return <Navigate to="/dashboard" />;

  const [rows, setRows] = useState<Row[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [sort, setSort] = useState<"ltv" | "events" | "recent">("ltv");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data: cs } = await supabase.from("companies").select("id, name").order("name");
      setCompanies((cs ?? []) as Company[]);
      const { data } = await supabase.from("customers").select("*");
      setRows((data ?? []) as Row[]);
    })();
    const ch = supabase.channel("customers-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, async () => {
        const { data } = await supabase.from("customers").select("*");
        setRows((data ?? []) as Row[]);
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    let r = rows;
    if (companyFilter !== "all") r = r.filter((x) => x.company_id === companyFilter);
    if (tagFilter !== "all") r = r.filter((x) => x.tags.includes(tagFilter));
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      r = r.filter((x) => x.full_name.toLowerCase().includes(s) || x.phone.includes(s));
    }
    r = [...r];
    if (sort === "ltv") r.sort((a, b) => Number(b.lifetime_value) - Number(a.lifetime_value));
    else if (sort === "events") r.sort((a, b) => b.total_events - a.total_events);
    else r.sort((a, b) => (b.last_event_date ?? "").localeCompare(a.last_event_date ?? ""));
    return r;
  }, [rows, companyFilter, tagFilter, q, sort]);

  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? "—";

  const stats = useMemo(() => {
    const total = rows.length;
    const repeat = rows.filter((r) => r.total_events >= 2).length;
    const vip = rows.filter((r) => r.tags.includes("vip")).length;
    const promoters = rows.filter((r) => r.tags.includes("promoter")).length;
    const ltv = rows.reduce((s, r) => s + Number(r.lifetime_value || 0), 0);
    const top = [...rows].sort((a, b) => Number(b.lifetime_value) - Number(a.lifetime_value))[0];
    return { total, repeat, vip, promoters, ltv, top };
  }, [rows]);

  const exportCsv = () => {
    const header = ["Name", "Phone", "Company", "Total events", "LTV", "Tags", "First event", "Last event", "Avg rating"];
    const lines = [header.join(",")].concat(filtered.map((r) =>
      [r.full_name, r.phone, companyName(r.company_id), r.total_events,
       Number(r.lifetime_value || 0), `"${r.tags.join("|")}"`, r.first_event_date ?? "",
       r.last_event_date ?? "", r.avg_rating ?? ""].join(",")
    ));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "customers.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><Users className="h-5 w-5" /> Customers</h1>
          <p className="text-sm text-muted-foreground">All clients across companies, ranked by value.</p>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Total customers</div><div className="text-xl font-semibold">{stats.total}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Repeat (2+)</div><div className="text-xl font-semibold">{stats.repeat}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">VIP (3+)</div><div className="text-xl font-semibold inline-flex items-center gap-1">{stats.vip} <Diamond className="h-4 w-4 text-amber-500" /></div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Promoters (4★+)</div><div className="text-xl font-semibold inline-flex items-center gap-1">{stats.promoters} <Star className="h-4 w-4 text-emerald-500" /></div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Total LTV</div><div className="text-xl font-semibold">{formatINR(stats.ltv)}</div></Card>
      </div>

      {stats.top && (
        <Card className="p-3 bg-primary/5 border-primary/20 text-sm">
          <span className="text-muted-foreground">Top client:</span>{" "}
          <Link to="/customers/$customerId" params={{ customerId: stats.top.id }} className="font-semibold text-primary hover:underline">
            {stats.top.full_name}
          </Link>{" "}
          — {stats.top.total_events} events — {formatINR(Number(stats.top.lifetime_value))}
        </Card>
      )}

      <Card className="p-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Input placeholder="Search name or phone…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Company" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All companies</SelectItem>
              {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Tag" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
              <SelectItem value="promoter">Promoter</SelectItem>
              <SelectItem value="returning">Returning</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ltv">Sort: Highest LTV</SelectItem>
              <SelectItem value="events">Sort: Most events</SelectItem>
              <SelectItem value="recent">Sort: Most recent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Events</TableHead>
              <TableHead className="text-right">LTV</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Last event</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id} className="cursor-pointer">
                <TableCell>
                  <Link to="/customers/$customerId" params={{ customerId: r.id }} className="font-medium text-primary hover:underline">
                    {r.full_name}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatPhoneIN(r.phone, false)}</TableCell>
                <TableCell className="text-sm">{companyName(r.company_id)}</TableCell>
                <TableCell className="text-right">{r.total_events}</TableCell>
                <TableCell className="text-right font-medium">{formatINR(Number(r.lifetime_value || 0))}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {r.tags.includes("vip") && <span className="text-[10px] px-1.5 py-0.5 rounded border bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 inline-flex items-center gap-0.5"><Diamond className="h-2.5 w-2.5" />VIP</span>}
                    {r.tags.includes("promoter") && <span className="text-[10px] px-1.5 py-0.5 rounded border bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 inline-flex items-center gap-0.5"><Star className="h-2.5 w-2.5" />Promoter</span>}
                    {r.tags.includes("returning") && <span className="text-[10px] px-1.5 py-0.5 rounded border bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 inline-flex items-center gap-0.5"><Repeat className="h-2.5 w-2.5" />Returning</span>}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{r.last_event_date ? formatDateIN(r.last_event_date) : "—"}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">No customers yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
