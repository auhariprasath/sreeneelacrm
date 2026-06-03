import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

interface Props {
  companyId: string | undefined;
}

export function PaymentCredentialsSection({ companyId }: Props) {
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId || !isAdmin) { setLoading(false); return; }
    setLoading(true);
    supabase
      .from("company_payment_credentials" as any)
      .select("razorpay_key_id,razorpay_key_secret")
      .eq("company_id", companyId)
      .maybeSingle()
      .then(({ data }) => {
        const row = (data as any) ?? {};
        setKeyId(row.razorpay_key_id ?? "");
        setKeySecret(row.razorpay_key_secret ?? "");
        setLoading(false);
      });
  }, [companyId, isAdmin]);

  if (!companyId) return <div className="text-sm text-muted-foreground p-6">Select a company first.</div>;
  if (!isAdmin) {
    return (
      <div className="text-sm text-muted-foreground p-4 border rounded-md">
        Payment credentials are restricted to admins. Ask your admin to configure these.
      </div>
    );
  }
  if (loading) return <div className="text-sm text-muted-foreground p-6">Loading…</div>;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("company_payment_credentials" as any)
      .upsert({
        company_id: companyId,
        razorpay_key_id: keyId.trim() || null,
        razorpay_key_secret: keySecret.trim() || null,
      } as any, { onConflict: "company_id" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saved ✓");
  };

  return (
    <div className="space-y-4 border rounded-md p-4">
      <div className="text-sm font-medium">Razorpay credentials (admin only)</div>
      <div className="space-y-1.5">
        <Label>Razorpay Key ID</Label>
        <Input value={keyId} onChange={(e) => setKeyId(e.target.value)} placeholder="rzp_test_xxx or rzp_live_xxx" />
      </div>
      <div className="space-y-1.5">
        <Label>Razorpay Key Secret</Label>
        <Input type="password" value={keySecret} onChange={(e) => setKeySecret(e.target.value)} placeholder="••••••••" />
        <p className="text-xs text-muted-foreground">Stored in a restricted table — only admins can view or edit.</p>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save credentials"}</Button>
      </div>
    </div>
  );
}
