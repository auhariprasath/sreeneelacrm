import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Star, Phone } from "lucide-react";
import { formatINR } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type Vendor = Database["public"]["Tables"]["vendors"]["Row"];
type VendorDraft = Partial<Vendor> & { name: string; service_type: string };

const EMPTY: VendorDraft = {
  name: "",
  service_type: "",
  wa_number: "",
  email: "",
  standard_rate: null,
  notes: "",
  is_active: true,
};

export function VendorsSection({ companyId }: { companyId: string | undefined }) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<VendorDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("service_type", { ascending: true })
      .order("name", { ascending: true });
    if (error) toast.error(error.message);
    setVendors((data as Vendor[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  if (!companyId) return <div className="text-sm text-muted-foreground p-6">Select a company first.</div>;

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.service_type.trim()) {
      toast.error("Name and service type are required.");
      return;
    }
    setSaving(true);
    const payload = {
      company_id: companyId,
      name: editing.name.trim(),
      service_type: editing.service_type.trim(),
      wa_number: editing.wa_number?.trim() || null,
      email: editing.email?.trim() || null,
      standard_rate: editing.standard_rate != null && editing.standard_rate !== ("" as any)
        ? Number(editing.standard_rate) : null,
      notes: editing.notes?.trim() || null,
      is_active: editing.is_active ?? true,
    };
    const { error } = editing.id
      ? await supabase.from("vendors").update(payload).eq("id", editing.id)
      : await supabase.from("vendors").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing.id ? "Vendor updated ✓" : "Vendor added ✓");
    setEditing(null);
    load();
  };

  const remove = async (v: Vendor) => {
    if (!confirm(`Remove vendor "${v.name}"? Existing bookings will keep the reference.`)) return;
    const { error } = await supabase.from("vendors")
      .update({ deleted_at: new Date().toISOString() }).eq("id", v.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Vendor removed");
    load();
  };

  // Group by service_type for readability
  const grouped = vendors.reduce<Record<string, Vendor[]>>((acc, v) => {
    (acc[v.service_type] ||= []).push(v); return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{vendors.length} vendor{vendors.length === 1 ? "" : "s"}</p>
        <Button size="sm" onClick={() => setEditing({ ...EMPTY })}>
          <Plus className="h-4 w-4 mr-1" /> Add vendor
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground p-6">Loading…</div>
      ) : vendors.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed rounded-md p-8 text-center">
          No vendors yet. Add caterers, florists, decorators, photographers, etc.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([type, list]) => (
            <div key={type}>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{type}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {list.map((v) => (
                  <div key={v.id} className="border rounded-md p-3 bg-card space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate flex items-center gap-2">
                          {v.name}
                          {!v.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                        </div>
                        {v.wa_number && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3" /> {v.wa_number}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => setEditing({ ...v } as VendorDraft)} aria-label="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600"
                          onClick={() => remove(v)} aria-label="Remove">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {v.standard_rate != null && <span>Rate: <span className="text-foreground font-medium">{formatINR(Number(v.standard_rate))}</span></span>}
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {v.rating ? Number(v.rating).toFixed(1) : "—"}
                        <span className="text-muted-foreground">({v.rating_count})</span>
                      </span>
                      <span>{v.total_bookings} booking{v.total_bookings === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit vendor" : "Add vendor"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Name *</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Sri Krishna Caterers" />
              </div>
              <div className="space-y-1.5">
                <Label>Service type *</Label>
                <Input value={editing.service_type} onChange={(e) => setEditing({ ...editing, service_type: e.target.value })} placeholder="e.g. Catering, Decor, DJ" />
              </div>
              <div className="space-y-1.5">
                <Label>WhatsApp number</Label>
                <Input value={editing.wa_number ?? ""} onChange={(e) => setEditing({ ...editing, wa_number: e.target.value })} placeholder="10-digit number" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Standard rate (₹)</Label>
                <Input type="number" value={editing.standard_rate ?? ""} onChange={(e) => setEditing({ ...editing, standard_rate: e.target.value as any })} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Notes</Label>
                <Textarea rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="Internal notes" />
              </div>
              <div className="flex items-center justify-between md:col-span-2 border rounded-md p-3">
                <div>
                  <div className="text-sm font-medium">Active</div>
                  <div className="text-xs text-muted-foreground">Inactive vendors won't appear in booking assignment.</div>
                </div>
                <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save vendor"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
