import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Mail, Copy, Download, FileText, CheckCircle2, AlertTriangle, XCircle, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatINR, formatDateIN, formatTimeOfDay } from "@/lib/format";
import { WhatsAppSendButton } from "@/components/whatsapp-send-button";
import { generateQuotationPdf, downloadBlob, type QuotationPdfInput } from "@/lib/quotation-pdf";
import type { Database } from "@/integrations/supabase/types";

type Quotation = Database["public"]["Tables"]["quotations"]["Row"];
type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Requirement = Database["public"]["Tables"]["requirements"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quotationId: string | null;
  onResponded?: () => void;
  onAgreed?: (quotationId: string) => void;
}

export function SendQuotationDialog({ open, onOpenChange, quotationId, onResponded, onAgreed }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<Quotation | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [respondNote, setRespondNote] = useState("");
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !quotationId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: q } = await supabase.from("quotations").select("*").eq("id", quotationId).maybeSingle();
      if (!q || cancelled) { setLoading(false); return; }
      const [{ data: l }, { data: r }, { data: c }] = await Promise.all([
        supabase.from("leads").select("*").eq("id", q.lead_id).maybeSingle(),
        supabase.from("requirements").select("*").eq("id", q.requirement_id).maybeSingle(),
        supabase.from("companies").select("*").eq("id", q.company_id).maybeSingle(),
      ]);
      if (cancelled) return;
      setQuote(q as Quotation);
      setLead(l as Lead); setRequirement(r as Requirement); setCompany(c as Company);

      const publicUrl = (q as any).public_token
        ? `${window.location.origin}/quotation/${(q as any).public_token}`
        : "";
      const tmpl = `Namaste {client_name}, here is your quotation from {company_name} for {event_type} on {event_date}.\n\nTotal: {total}\n\nView & approve online: {link}\n\nReply AGREED to confirm, or let us know if you'd like changes. Thank you!`;
      const filled = tmpl
        .replace("{client_name}", (l as Lead | null)?.full_name ?? "")
        .replace("{company_name}", (c as Company | null)?.name ?? "")
        .replace("{event_type}", (r as Requirement | null)?.event_type ?? "your event")
        .replace("{event_date}", (r as Requirement | null)?.event_date ? formatDateIN((r as Requirement).event_date as string) : "the planned date")
        .replace("{total}", formatINR(Number((q as Quotation).total)))
        .replace("{link}", publicUrl);
      setMessage(filled);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, quotationId]);

  useEffect(() => {
    if (!open) { setQuote(null); setLead(null); setRequirement(null); setCompany(null); setRespondNote(""); }
  }, [open]);

  const pdfInput: QuotationPdfInput | null = useMemo(() => {
    if (!quote || !lead || !requirement || !company) return null;
    return {
      company: {
        name: company.name,
        address: company.address, email: company.email, wa_number: company.wa_number,
        gstin: company.gstin, upi_id: company.upi_id, bank_account: company.bank_account, ifsc: company.ifsc,
        logo_url: company.logo_url, cancellation_policy: company.cancellation_policy,
      },
      client: { name: lead.full_name, phone: lead.phone },
      event: {
        type: requirement.event_type, date: requirement.event_date,
        start_time: requirement.start_time, end_time: requirement.end_time,
        venue: null, guest_count: requirement.guest_count,
      },
      quotation: {
        number: quote.quotation_number, version: quote.version,
        services: (quote.services as any) ?? [], addons: (quote.addons as any) ?? [],
        subtotal: Number(quote.subtotal), discount_percent: Number(quote.discount_percent),
        discount_amount: Number(quote.discount_amount), gst_applied: quote.gst_applied,
        gst_percent: Number(quote.gst_percent), gst_amount: Number(quote.gst_amount),
        total: Number(quote.total), created_at: quote.created_at,
      },
    };
  }, [quote, lead, requirement, company]);

  const buildPdf = async (): Promise<Blob | null> => pdfInput ? await generateQuotationPdf({ ...pdfInput, authorisedBy: profile?.full_name ?? null }) : null;
  const pdfFilename = quote ? `Quotation-${quote.quotation_number || quote.id.slice(0, 6)}-v${quote.version}.pdf` : "quotation.pdf";

  const markSent = async (channel: "whatsapp" | "email" | "sms" | null, label: string) => {
    if (!quote) return;
    const patch: Database["public"]["Tables"]["quotations"]["Update"] = {
      status: quote.status === "draft" ? "sent" : quote.status,
      sent_at: new Date().toISOString(),
    };
    if (channel) patch.sent_via = channel;
    await supabase.from("quotations").update(patch).eq("id", quote.id);
    await supabase.from("activity_logs").insert({
      lead_id: quote.lead_id,
      action: `Quotation v${quote.version} sent via ${label}`,
      action_type: "system", performed_by: profile?.id ?? null,
      metadata: { quotation_id: quote.id, total: Number(quote.total) },
    });
    onResponded?.();
  };

  const handleWhatsAppSent = async (mode: "device" | "api") => {
    await markSent("whatsapp", mode === "api" ? "WhatsApp API" : "WhatsApp");
    toast.success(mode === "api" ? "WhatsApp sent via API" : "Opened WhatsApp");
  };

  const sendViaEmail = async () => {
    setSending("email");
    try {
      const subject = `Quotation from ${company?.name ?? ""} — v${quote?.version}`;
      const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      window.location.href = url;
      await markSent("email", "Email");
      toast.success("Opened email");
    } finally { setSending(null); }
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message);
    await markSent(null, "Copied link");
    toast.success("Message copied to clipboard");
  };

  const downloadOnly = async () => {
    const blob = await buildPdf(); if (blob) { downloadBlob(blob, pdfFilename); toast.success("PDF downloaded"); }
  };

  const respond = async (kind: "agreed" | "negotiating" | "declined" | "revision") => {
    if (!quote) return;
    setResponding(kind);
    try {
      const labels: Record<string, string> = {
        agreed: "Client AGREED to quotation",
        negotiating: "Client is NEGOTIATING the quotation",
        declined: "Client DECLINED the quotation",
        revision: "Client requested a REVISION",
      };
      const statusMap: Record<string, Database["public"]["Enums"]["quotation_status"] | null> = {
        agreed: "agreed", negotiating: null, declined: "declined", revision: "revised",
      };
      const newStatus = statusMap[kind];
      const patch: Database["public"]["Tables"]["quotations"]["Update"] = {};
      if (newStatus) patch.status = newStatus;
      if (kind === "agreed") patch.agreed_at = new Date().toISOString();
      if (Object.keys(patch).length) await supabase.from("quotations").update(patch).eq("id", quote.id);
      await supabase.from("activity_logs").insert({
        lead_id: quote.lead_id,
        action: `${labels[kind]} (v${quote.version})`,
        note: respondNote || null,
        action_type: "status_change", performed_by: profile?.id ?? null,
        metadata: { quotation_id: quote.id },
      });
      toast.success("Response logged");
      onResponded?.();
      onOpenChange(false);
      if (kind === "agreed" && quote) onAgreed?.(quote.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't log response");
    } finally { setResponding(null); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {loading ? "Loading…" : `Send quotation v${quote?.version ?? ""}`}
          </DialogTitle>
        </DialogHeader>

        {loading || !quote ? (
          <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs defaultValue="send" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-4 mt-3 grid grid-cols-2">
              <TabsTrigger value="send">Send</TabsTrigger>
              <TabsTrigger value="response">Log response</TabsTrigger>
            </TabsList>

            <TabsContent value="send" className="flex-1 overflow-y-auto p-4 space-y-3 mt-2">
              <div className="bg-muted/40 border rounded-md p-3 text-sm flex items-center justify-between">
                <div>
                  <div className="font-medium">{lead?.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    Total {formatINR(Number(quote.total))}
                    {requirement?.event_date && ` · ${formatDateIN(requirement.event_date)}`}
                    {requirement?.start_time && ` ${formatTimeOfDay(requirement.start_time)}`}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={downloadOnly}>
                  <Download className="h-4 w-4 mr-1" /> PDF
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Message</Label>
                <Textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
                <div className="text-[11px] text-muted-foreground">The message includes a link your client can open to view & approve the quotation online. Use the PDF button only if you want a copy.</div>
              </div>

              <div className="grid grid-cols-[1fr_auto_auto] gap-2 pt-1 items-stretch">
                <WhatsAppSendButton
                  phone={lead?.phone}
                  message={message}
                  disabled={!!sending}
                  onSent={handleWhatsAppSent}
                />
                <Button variant="outline" onClick={sendViaEmail} disabled={!!sending}>
                  <Mail className="h-4 w-4 mr-1" /> Email
                </Button>
                <Button variant="outline" onClick={copyMessage} disabled={!!sending}>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </div>

              {(quote as any).public_token && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    const url = `${window.location.origin}/quotation/${(quote as any).public_token}`;
                    await navigator.clipboard.writeText(url);
                    toast.success("Public quotation link copied");
                  }}
                >
                  <Copy className="h-4 w-4 mr-1" /> Copy public quotation link
                </Button>
              )}

              {quote.sent_at && (
                <div className="text-xs text-muted-foreground border-t pt-2">
                  Last sent via <span className="capitalize">{quote.sent_via}</span> · {new Date(quote.sent_at).toLocaleString("en-IN")}
                </div>
              )}
            </TabsContent>

            <TabsContent value="response" className="flex-1 overflow-y-auto p-4 space-y-3 mt-2">
              <div className="text-sm text-muted-foreground">Log the client's reply after they review the quotation.</div>
              <Textarea rows={3} placeholder="Optional note (e.g. asked for 10% off, wants to confirm tomorrow)" value={respondNote} onChange={(e) => setRespondNote(e.target.value)} />
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button onClick={() => respond("agreed")} disabled={!!responding} className="bg-success hover:bg-success text-white">
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Agreed
                </Button>
                <Button onClick={() => respond("negotiating")} disabled={!!responding} variant="outline">
                  <AlertTriangle className="h-4 w-4 mr-1" /> Negotiating
                </Button>
                <Button onClick={() => respond("revision")} disabled={!!responding} variant="outline">
                  <RotateCcw className="h-4 w-4 mr-1" /> Needs revision
                </Button>
                <Button onClick={() => respond("declined")} disabled={!!responding} variant="outline" className="text-destructive hover:text-destructive">
                  <XCircle className="h-4 w-4 mr-1" /> Declined
                </Button>
              </div>
              <div className="text-[11px] text-muted-foreground pt-2">
                "Agreed" unlocks booking & payment in the next step. "Needs revision" lets you open the builder to send a new version.
              </div>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className="border-t p-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
