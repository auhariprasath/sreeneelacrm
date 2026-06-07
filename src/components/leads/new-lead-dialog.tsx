import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (leadId: string) => void;
}

const LANGUAGES = ["English", "Tamil", "Hindi", "Telugu", "Malayalam", "Kannada"];

export function NewLeadDialog({ open, onOpenChange, onCreated }: Props) {
  const { profile, companies, activeCompanyId, role } = useAuth();
  const targetCompanyId = role === "super_admin" ? activeCompanyId ?? companies[0]?.id ?? null : profile?.company_id ?? null;

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState("English");
  const [source, setSource] = useState<"inbound_call" | "walkin" | "referral" | "portal" | "manual">("manual");
  const [score, setScore] = useState<"hot" | "warm" | "cold">("warm");
  const [notes, setNotes] = useState("");
  const [referredByName, setReferredByName] = useState("");
  const [referredByLeadId, setReferredByLeadId] = useState<string | null>(null);
  const [refSearch, setRefSearch] = useState<{ id: string; full_name: string; phone: string }[]>([]);
  const [duplicate, setDuplicate] = useState<{ company: string; status: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setFullName(""); setPhone(""); setEmail(""); setLanguage("English");
    setSource("manual"); setScore("warm"); setNotes(""); setDuplicate(null);
    setReferredByName(""); setReferredByLeadId(null); setRefSearch([]);
  };

  const normalizedPhone = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(-10);
    return d.length === 10 ? d : null;
  };

  const checkDuplicate = async (raw: string) => {
    setDuplicate(null);
    const d = normalizedPhone(raw);
    if (!d) return;
    const { data } = await supabase
      .from("leads")
      .select("id,status,company_id")
      .ilike("phone", `%${d}`)
      .is("deleted_at", null)
      .limit(1);
    if (data && data[0]) {
      const c = companies.find((c) => c.id === data[0].company_id);
      setDuplicate({ company: c?.name ?? "another company", status: data[0].status });
    }
  };

  const submit = async () => {
    if (!targetCompanyId) { toast.error("Select a company first."); return; }
    const d = normalizedPhone(phone);
    if (!fullName.trim()) { toast.error("Enter a name."); return; }
    if (!d) { toast.error("Enter a valid 10-digit phone."); return; }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Enter a valid email address."); return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.from("leads").insert({
      full_name: fullName.trim(),
      phone: `+91${d}`,
      email: trimmedEmail || null,
      language,
      source,
      lead_score: score,
      notes: notes.trim() || null,
      company_id: targetCompanyId,
      created_by: profile?.id,
      assigned_to: profile?.id,
      referred_by_name: source === "referral" ? (referredByName.trim() || null) : null,
      referred_by_lead_id: source === "referral" ? referredByLeadId : null,
    }).select("id").single();
    setSubmitting(false);

    if (error) { toast.error(error.message); return; }
    toast.success("Lead created");
    // log activity
    if (data) {
      await supabase.from("activity_logs").insert({
        lead_id: data.id, action: "Lead created", action_type: "intake", performed_by: profile?.id,
      });
    }
    reset();
    onOpenChange(false);
    if (data) onCreated?.(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
          <DialogDescription>Capture an enquiry. Phone is checked across all companies.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ln-name">Full name</Label>
            <Input id="ln-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Anand Kumar" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ln-phone">Phone (10 digits)</Label>
            <Input
              id="ln-phone"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={(e) => checkDuplicate(e.target.value)}
              placeholder="98XXXXXXXX"
            />
            {duplicate && (
              <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md p-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>This phone already exists in <b>{duplicate.company}</b> (status: {duplicate.status}). Creating anyway will make a separate lead.</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ln-email">Email <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="ln-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Score</Label>
              <Select value={score} onValueChange={(v) => setScore(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hot">Hot</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="cold">Cold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select value={source} onValueChange={(v) => setSource(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="inbound_call">Inbound call</SelectItem>
                <SelectItem value="walkin">Walk-in</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="portal">Portal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {source === "referral" && (
            <div className="space-y-1.5">
              <Label htmlFor="ln-ref">Referred by</Label>
              <Input
                id="ln-ref"
                value={referredByName}
                placeholder="Type a name to search existing leads…"
                onChange={async (e) => {
                  const v = e.target.value;
                  setReferredByName(v);
                  setReferredByLeadId(null);
                  if (v.trim().length < 2) { setRefSearch([]); return; }
                  const { data } = await supabase
                    .from("leads")
                    .select("id,full_name,phone")
                    .ilike("full_name", `%${v.trim()}%`)
                    .is("deleted_at", null)
                    .limit(5);
                  setRefSearch((data as any) ?? []);
                }}
              />
              {refSearch.length > 0 && !referredByLeadId && (
                <div className="border rounded-md bg-popover divide-y">
                  {refSearch.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => { setReferredByLeadId(r.id); setReferredByName(r.full_name); setRefSearch([]); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent min-h-[44px]"
                    >
                      <div className="font-medium">{r.full_name}</div>
                      <div className="text-xs text-muted-foreground">{r.phone}</div>
                    </button>
                  ))}
                </div>
              )}
              {referredByLeadId && (
                <div className="text-[11px] text-emerald-700 dark:text-emerald-300">Linked to existing lead ✓</div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ln-notes">Notes (optional)</Label>
            <Textarea id="ln-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Saving…" : "Create lead"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
