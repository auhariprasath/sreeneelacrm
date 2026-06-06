import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getCompanyDetails,
  updateCompanyDetails,
  uploadCompanyFile,
  removeCompanyFile,
} from "@/lib/api/companies.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Trash2, Upload } from "lucide-react";

type CompanyType = "banquet" | "garden" | "mandapam" | "party";

interface Form {
  id: string;
  name: string;
  type: CompanyType;
  wa_number: string;
  company_phone: string;
  email: string;
  address: string;
  full_address: string;
  google_maps_link: string;
  gstin: string;
  bank_account: string;
  ifsc: string;
  upi_id: string;
  brand_color: string;
  max_capacity: string;
  cancellation_policy: string;
  portfolio_url: string;
  video_url: string;
  include_photos_in_requirements: boolean;
  include_portfolio_in_day5: boolean;
}

const empty: Form = {
  id: "", name: "", type: "banquet",
  wa_number: "", company_phone: "", email: "",
  address: "", full_address: "", google_maps_link: "",
  gstin: "", bank_account: "", ifsc: "", upi_id: "",
  brand_color: "#6366f1", max_capacity: "",
  cancellation_policy: "",
  portfolio_url: "", video_url: "",
  include_photos_in_requirements: true,
  include_portfolio_in_day5: true,
};

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function CompanyDetailsDialog({
  companyId, open, onOpenChange, onSaved,
}: {
  companyId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}) {
  const get = useServerFn(getCompanyDetails);
  const save = useServerFn(updateCompanyDetails);
  const upload = useServerFn(uploadCompanyFile);
  const removeFile = useServerFn(removeCompanyFile);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [gallery, setGallery] = useState<{ path: string; url: string }[]>([]);

  useEffect(() => {
    if (!open || !companyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const d = await get({ data: { id: companyId } });
        if (cancelled) return;
        setForm({
          id: d.id,
          name: d.name ?? "",
          type: (d.type as CompanyType) ?? "banquet",
          wa_number: d.wa_number ?? "",
          company_phone: d.company_phone ?? "",
          email: d.email ?? "",
          address: d.address ?? "",
          full_address: d.full_address ?? "",
          google_maps_link: d.google_maps_link ?? "",
          gstin: d.gstin ?? "",
          bank_account: d.bank_account ?? "",
          ifsc: d.ifsc ?? "",
          upi_id: d.upi_id ?? "",
          brand_color: d.brand_color ?? "#6366f1",
          max_capacity: d.max_capacity != null ? String(d.max_capacity) : "",
          cancellation_policy: d.cancellation_policy ?? "",
        });
        setLogoPath(d.logo_url ?? null);
        setLogoUrl(d.logoSignedUrl ?? null);
        setGallery(d.gallerySignedUrls ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, companyId, get]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setBusy(true);
    try {
      await save({
        data: {
          id: form.id,
          name: form.name.trim(),
          type: form.type,
          wa_number: form.wa_number.trim() || null,
          company_phone: form.company_phone.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          full_address: form.full_address.trim() || null,
          google_maps_link: form.google_maps_link.trim() || null,
          gstin: form.gstin.trim() || null,
          bank_account: form.bank_account.trim() || null,
          ifsc: form.ifsc.trim() || null,
          upi_id: form.upi_id.trim() || null,
          brand_color: form.brand_color || null,
          max_capacity: form.max_capacity ? Number(form.max_capacity) : null,
          cancellation_policy: form.cancellation_policy.trim() || null,
        },
      });
      toast.success("Saved");
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally { setBusy(false); }
  };

  const handleUpload = async (kind: "logo" | "gallery", file: File) => {
    if (!companyId) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    try {
      const data_base64 = await fileToBase64(file);
      const res = await upload({
        data: {
          company_id: companyId, kind,
          filename: file.name,
          content_type: file.type || "application/octet-stream",
          data_base64,
        },
      });
      if (kind === "logo") {
        setLogoPath(res.path);
        setLogoUrl(res.url);
      } else {
        setGallery((g) => [...g, { path: res.path, url: res.url }]);
      }
      toast.success("Uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const handleRemove = async (kind: "logo" | "gallery", path: string) => {
    if (!companyId) return;
    try {
      await removeFile({ data: { company_id: companyId, kind, path } });
      if (kind === "logo") { setLogoPath(null); setLogoUrl(null); }
      else setGallery((g) => g.filter((p) => p.path !== path));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit company details</DialogTitle>
          <DialogDescription>
            These details appear on quotations, receipts, the public booking page, and WhatsApp messages.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Basics</h4>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => set("name", e.target.value)} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => set("type", v as CompanyType)}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="banquet">Banquet</SelectItem>
                      <SelectItem value="garden">Garden</SelectItem>
                      <SelectItem value="mandapam">Mandapam</SelectItem>
                      <SelectItem value="party">Party</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Max capacity (guests)</Label>
                  <Input type="number" inputMode="numeric" value={form.max_capacity}
                    onChange={(e) => set("max_capacity", e.target.value)} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label>Brand colour</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.brand_color}
                      onChange={(e) => set("brand_color", e.target.value)}
                      className="h-10 w-14 rounded-md border border-input bg-transparent cursor-pointer" />
                    <Input value={form.brand_color}
                      onChange={(e) => set("brand_color", e.target.value)}
                      placeholder="#6366f1" className="h-10 font-mono" />
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Contact</h4>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>WhatsApp Business number</Label>
                  <Input value={form.wa_number} onChange={(e) => set("wa_number", e.target.value)}
                    placeholder="+91 98xxxxxxxx" className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label>Office phone</Label>
                  <Input value={form.company_phone} onChange={(e) => set("company_phone", e.target.value)}
                    className="h-10" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
                    className="h-10" />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Address</h4>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Short address (for headers)</Label>
                  <Input value={form.address} onChange={(e) => set("address", e.target.value)}
                    placeholder="Adyar, Chennai" className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label>Full address</Label>
                  <Textarea value={form.full_address} onChange={(e) => set("full_address", e.target.value)}
                    rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label>Google Maps link</Label>
                  <Input value={form.google_maps_link} onChange={(e) => set("google_maps_link", e.target.value)}
                    placeholder="https://maps.app.goo.gl/…" className="h-10" />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold">GST &amp; banking</h4>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>GSTIN</Label>
                  <Input value={form.gstin} onChange={(e) => set("gstin", e.target.value)}
                    placeholder="22AAAAA0000A1Z5" className="h-10 font-mono uppercase" />
                </div>
                <div className="space-y-1.5">
                  <Label>UPI ID</Label>
                  <Input value={form.upi_id} onChange={(e) => set("upi_id", e.target.value)}
                    placeholder="venue@upi" className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label>Bank account number</Label>
                  <Input value={form.bank_account} onChange={(e) => set("bank_account", e.target.value)}
                    className="h-10 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label>IFSC code</Label>
                  <Input value={form.ifsc} onChange={(e) => set("ifsc", e.target.value)}
                    placeholder="HDFC0001234" className="h-10 font-mono uppercase" />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Logo</h4>
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <div className="relative">
                    <img src={logoUrl} alt="Logo" className="h-20 w-20 object-contain rounded-md border bg-muted" />
                    <button type="button" onClick={() => logoPath && handleRemove("logo", logoPath)}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-20 w-20 rounded-md border border-dashed bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                    No logo
                  </div>
                )}
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload("logo", f);
                      e.target.value = "";
                    }} />
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span><Upload className="h-4 w-4 mr-1.5" /> Upload logo</span>
                  </Button>
                </label>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Venue photo gallery</h4>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {gallery.map((g) => (
                  <div key={g.path} className="relative aspect-square">
                    <img src={g.url} alt="" className="h-full w-full object-cover rounded-md border" />
                    <button type="button" onClick={() => handleRemove("gallery", g.path)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className="aspect-square rounded-md border border-dashed flex flex-col items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-muted/30">
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload("gallery", f);
                      e.target.value = "";
                    }} />
                  <Upload className="h-5 w-5 mb-1" /> Add
                </label>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Cancellation policy</h4>
              <Textarea rows={3} value={form.cancellation_policy}
                onChange={(e) => set("cancellation_policy", e.target.value)}
                placeholder="Shown on quotations and the public booking page." />
            </section>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy} className="min-h-11">Cancel</Button>
          <Button onClick={submit} disabled={busy || loading} className="min-h-11">
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
