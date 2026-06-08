import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { SkeletonList } from "@/components/skeleton-list";
import { Plus, Megaphone, Send, Download, Trash2, MessageSquare } from "lucide-react";
import { buildWaMeLink } from "@/lib/utils";

export const Route = createFileRoute("/_app/campaigns")({ component: CampaignsPage });

type Filters = {
  lead_score?: string[];
  status?: string[];
  source?: string[];
  language?: string;
};

interface CampaignRow {
  id: string;
  company_id: string;
  name: string;
  channel: "whatsapp" | "sms";
  message: string;
  segment_filters: Filters;
  sms_fallback: boolean;
  status: string;
  total_leads: number;
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  sent_at: string | null;
  created_at: string;
}

const SCORES = ["hot", "warm", "cold"];
const STATUSES = ["new", "contacted", "interested", "negotiating", "booked", "dropped"];
const SOURCES = ["manual", "walk_in", "referral", "instagram", "google", "facebook", "wedding_site", "other"];

function buildLeadQuery(companyId: string, f: Filters, opts?: { count?: boolean }) {
  const sel = opts?.count
    ? supabase.from("leads").select("id", { count: "exact", head: true })
    : supabase.from("leads").select("id,full_name,phone,language,lead_score,status,source");
  let q = sel
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .eq("is_blacklisted", false);
  if (f.lead_score?.length) q = q.in("lead_score", f.lead_score as any);
  if (f.status?.length) q = q.in("status", f.status as any);
  if (f.source?.length) q = q.in("source", f.source as any);
  if (f.language?.trim()) q = q.eq("language", f.language.trim());
  return q;
}

function CampaignsPage() {
  const { profile, role, loading, activeCompanyId } = useAuth();
  const companyId = role === "super_admin" ? activeCompanyId : profile?.company_id ?? null;

  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState<CampaignRow | null>(null);

  const load = async () => {
    setListLoading(true);
    let q = supabase
      .from("campaigns")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (companyId) q = q.eq("company_id", companyId);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data ?? []) as any);
    setListLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  if (loading) return null;
  if (!role) return <Navigate to="/login" replace />;

  const canManage = role === "admin" || role === "super_admin";

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold flex items-center gap-2"><Megaphone className="h-5 w-5" /> Campaigns</h1>
          <p className="text-sm text-muted-foreground">Bulk WhatsApp/SMS to a segment of your leads.</p>
        </div>
        {canManage && companyId && (
          <Button onClick={() => setOpen(true)} className="min-h-11"><Plus className="h-4 w-4 mr-1" /> New campaign</Button>
        )}
      </div>

      {listLoading ? (
        <SkeletonList rows={4} />
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No campaigns yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <CampaignCard key={c.id} c={c} canManage={canManage} onSend={() => setSendOpen(c)} onChanged={load} />
          ))}
        </div>
      )}

      {open && companyId && (
        <NewCampaignDialog companyId={companyId} onClose={() => setOpen(false)} onCreated={load} />
      )}
      {sendOpen && (
        <SendDialog campaign={sendOpen} companyId={sendOpen.company_id} onClose={() => { setSendOpen(null); load(); }} />
      )}
    </div>
  );
}

function CampaignCard({ c, canManage, onSend, onChanged }: { c: CampaignRow; canManage: boolean; onSend: () => void; onChanged: () => void }) {
  const exportCsv = async () => {
    const { data, error } = await supabase
      .from("campaign_leads")
      .select("status,channel_used,sent_at,delivered_at,error_text,lead:leads(full_name,phone,language)")
      .eq("campaign_id", c.id);
    if (error) { toast.error(error.message); return; }
    const rows = [["Name", "Phone", "Language", "Channel", "Status", "Sent at", "Error"]];
    for (const r of (data ?? []) as any[]) {
      rows.push([
        r.lead?.full_name ?? "",
        r.lead?.phone ?? "",
        r.lead?.language ?? "",
        r.channel_used ?? "",
        r.status ?? "",
        r.sent_at ?? "",
        r.error_text ?? "",
      ]);
    }
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${c.name.replace(/[^a-z0-9]/gi, "_")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const remove = async () => {
    if (!confirm("Delete this campaign?")) return;
    const { error } = await supabase.from("campaigns").update({ deleted_at: new Date().toISOString() }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    onChanged();
  };

  const statusColor: Record<string, string> = {
    draft: "bg-muted text-foreground",
    sending: "bg-warning text-white",
    completed: "bg-success text-white",
    cancelled: "bg-muted text-muted-foreground",
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{c.name}</span>
              <Badge className={`text-[10px] ${statusColor[c.status] ?? ""}`}>{c.status}</Badge>
              <Badge variant="outline" className="text-[10px] uppercase">{c.channel}</Badge>
              {c.sms_fallback && <Badge variant="secondary" className="text-[10px]">SMS fallback</Badge>}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{c.message}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {canManage && c.status !== "completed" && (
              <Button size="sm" onClick={onSend} className="min-h-10"><Send className="h-4 w-4 mr-1" /> Send</Button>
            )}
            {canManage && (
              <Button size="sm" variant="outline" onClick={exportCsv} className="min-h-10"><Download className="h-4 w-4 mr-1" /> CSV</Button>
            )}
            {canManage && c.status === "draft" && (
              <Button size="sm" variant="ghost" onClick={remove} className="min-h-10 text-destructive"><Trash2 className="h-4 w-4" /></Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <Stat label="Leads" value={c.total_leads} />
          <Stat label="Sent" value={c.total_sent} />
          <Stat label="Delivered" value={c.total_delivered} />
          <Stat label="Failed" value={c.total_failed} />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded px-2 py-1.5">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium tabular-nums">{value}</div>
    </div>
  );
}

function MultiCheck({ label, options, value, onChange }: { label: string; options: string[]; value: string[] | undefined; onChange: (v: string[]) => void }) {
  const set = new Set(value ?? []);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o} className="flex items-center gap-1.5 text-xs border rounded-md px-2.5 py-1.5 cursor-pointer">
            <Checkbox checked={set.has(o)} onCheckedChange={(c) => {
              const next = new Set(set);
              if (c) next.add(o); else next.delete(o);
              onChange(Array.from(next));
            }} />
            <span className="capitalize">{o.replace(/_/g, " ")}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function NewCampaignDialog({ companyId, onClose, onCreated }: { companyId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [smsFallback, setSmsFallback] = useState(true);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      const { count, error } = await (buildLeadQuery(companyId, filters, { count: true }) as any);
      if (!error) setCount(count ?? 0);
    }, 200);
    return () => clearTimeout(t);
  }, [filters, companyId]);

  const create = async () => {
    if (!name.trim() || !message.trim()) { toast.error("Name and message are required"); return; }
    setBusy(true);
    const { error } = await supabase.from("campaigns").insert({
      company_id: companyId,
      name: name.trim(),
      channel,
      message: message.trim(),
      segment_filters: filters as any,
      sms_fallback: smsFallback,
      total_leads: count ?? 0,
      status: "draft",
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Campaign created");
    onCreated(); onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
          <DialogDescription>Pick the audience and the message. You can preview the count before sending.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Diwali offer 2026" className="h-11" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <div className="flex gap-2">
                {(["whatsapp", "sms"] as const).map((c) => (
                  <Button key={c} type="button" variant={channel === c ? "default" : "outline"} size="sm" onClick={() => setChannel(c)} className="min-h-10 flex-1 uppercase">{c}</Button>
                ))}
              </div>
            </div>
            {channel === "whatsapp" && (
              <label className="flex items-center justify-between gap-3 text-sm border rounded-md px-3 py-2.5 mt-6">
                <span>SMS fallback if no WA</span>
                <Switch checked={smsFallback} onCheckedChange={setSmsFallback} />
              </label>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Hi {{name}}, ..." />
          </div>
          <div className="border rounded-md p-3 space-y-3">
            <div className="text-sm font-medium">Audience</div>
            <MultiCheck label="Lead score" options={SCORES} value={filters.lead_score} onChange={(v) => setFilters({ ...filters, lead_score: v })} />
            <MultiCheck label="Status" options={STATUSES} value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} />
            <MultiCheck label="Source" options={SOURCES} value={filters.source} onChange={(v) => setFilters({ ...filters, source: v })} />
            <div className="space-y-1.5">
              <Label className="text-xs">Language (exact match, optional)</Label>
              <Input value={filters.language ?? ""} onChange={(e) => setFilters({ ...filters, language: e.target.value })} placeholder="English / Tamil" className="h-10" />
            </div>
            <div className="text-xs text-muted-foreground">Matching leads: <span className="font-semibold text-foreground">{count ?? "…"}</span> (flagged leads excluded)</div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy} className="min-h-11">Cancel</Button>
          <Button onClick={create} disabled={busy || !count} className="min-h-11">{busy ? "Creating…" : `Create draft (${count ?? 0})`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PendingLead {
  campaign_lead_id: string;
  lead_id: string;
  full_name: string;
  phone: string;
}

function SendDialog({ campaign, companyId, onClose }: { campaign: CampaignRow; companyId: string; onClose: () => void }) {
  const [pending, setPending] = useState<PendingLead[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);

  const personalise = (lead: PendingLead) => campaign.message.replace(/\{\{\s*name\s*\}\}/gi, lead.full_name.split(" ")[0] ?? lead.full_name);

  const ensureRows = async () => {
    setPreparing(true);
    // If no campaign_leads yet, materialise them
    const { count } = await supabase.from("campaign_leads").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id);
    if (!count) {
      const { data: leads } = await buildLeadQuery(companyId, campaign.segment_filters ?? {});
      const inserts = (leads ?? []).map((l: any) => ({
        campaign_id: campaign.id,
        lead_id: l.id,
        company_id: companyId,
        channel_used: campaign.channel,
        status: "pending" as const,
      }));
      if (inserts.length) {
        const { error } = await supabase.from("campaign_leads").insert(inserts as any);
        if (error) { toast.error(error.message); setPreparing(false); return; }
        await supabase.from("campaigns").update({ total_leads: inserts.length } as any).eq("id", campaign.id);
      }
    }
    setPreparing(false);
  };

  const load = async () => {
    setLoading(true);
    await ensureRows();
    const { data, error } = await supabase
      .from("campaign_leads")
      .select("id,lead_id,lead:leads(full_name,phone)")
      .eq("campaign_id", campaign.id)
      .eq("status", "pending")
      .order("created_at");
    if (error) { toast.error(error.message); setLoading(false); return; }
    setPending(((data ?? []) as any[]).map((r) => ({
      campaign_lead_id: r.id,
      lead_id: r.lead_id,
      full_name: r.lead?.full_name ?? "",
      phone: r.lead?.phone ?? "",
    })));
    setIdx(0);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [campaign.id]);

  const current = pending[idx];
  const remaining = pending.length - idx;

  const markSent = async (status: "sent" | "failed", note?: string) => {
    if (!current) return;
    const now = new Date().toISOString();
    await supabase.from("campaign_leads").update({
      status,
      sent_at: status === "sent" ? now : null,
      error_text: status === "failed" ? note ?? "Skipped" : null,
    }).eq("id", current.campaign_lead_id);

    // increment counters
    await supabase.rpc as any;
    const patch: any = {};
    if (status === "sent") patch.total_sent = (campaign.total_sent ?? 0) + 1;
    else patch.total_failed = (campaign.total_failed ?? 0) + 1;
    await supabase.from("campaigns").update(patch).eq("id", campaign.id);
    campaign.total_sent = patch.total_sent ?? campaign.total_sent;
    campaign.total_failed = patch.total_failed ?? campaign.total_failed;

    if (idx + 1 >= pending.length) {
      await supabase.from("campaigns").update({ status: "completed", sent_at: now }).eq("id", campaign.id);
      toast.success("Campaign completed");
      onClose();
      return;
    }
    setIdx(idx + 1);
  };

  const openWhatsApp = () => {
    if (!current) return;
    const url = buildWaMeLink(current.phone, personalise(current));
    if (!url) { toast.error("Invalid phone number"); return; }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openSms = () => {
    if (!current) return;
    const text = encodeURIComponent(personalise(current));
    window.location.href = `sms:${current.phone}?body=${text}`;
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send: {campaign.name}</DialogTitle>
          <DialogDescription>
            Open each message in {campaign.channel === "whatsapp" ? "WhatsApp" : "SMS"}, then mark as sent. Skipped contacts are recorded as failed.
          </DialogDescription>
        </DialogHeader>
        {loading || preparing ? (
          <SkeletonList rows={3} />
        ) : !current ? (
          <div className="text-sm text-muted-foreground p-4 text-center">Nothing pending.</div>
        ) : (
          <div className="space-y-3">
            <div className="border rounded-md p-3">
              <div className="text-xs text-muted-foreground">{idx + 1} of {pending.length} · {remaining} remaining</div>
              <div className="font-medium">{current.full_name}</div>
              <div className="text-sm text-muted-foreground">{current.phone}</div>
              <div className="mt-2 text-sm whitespace-pre-wrap border-t pt-2">{personalise(current)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {campaign.channel === "whatsapp" ? (
                <Button onClick={openWhatsApp} className="min-h-11"><MessageSquare className="h-4 w-4 mr-1" /> Open WhatsApp</Button>
              ) : (
                <Button onClick={openSms} className="min-h-11"><MessageSquare className="h-4 w-4 mr-1" /> Open SMS</Button>
              )}
              {campaign.channel === "whatsapp" && campaign.sms_fallback && (
                <Button variant="outline" onClick={openSms} className="min-h-11">SMS fallback</Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => markSent("failed", "Skipped")} className="min-h-11">Skip</Button>
              <Button onClick={() => markSent("sent")} className="min-h-11">Mark sent</Button>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="min-h-11">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
