import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, IndianRupee, Loader2, Upload } from "lucide-react";
import { formatINR } from "@/lib/format";
import { getPaymentByToken, submitPaymentProof, uploadPaymentProof } from "@/lib/api/payments-public.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/payment/$token")({
  head: () => ({
    meta: [
      { title: "Submit payment proof" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PublicPaymentPage,
  errorComponent: ({ error }) => (
    <div className="min-h-dvh grid place-items-center p-6 text-sm text-muted-foreground">
      Could not load payment. {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-dvh grid place-items-center p-6 text-sm text-muted-foreground">
      Payment link not found.
    </div>
  ),
});

function PublicPaymentPage() {
  const { token } = Route.useParams();
  const fetchP = useServerFn(getPaymentByToken);
  const submit = useServerFn(submitPaymentProof);
  const upload = useServerFn(uploadPaymentProof);
  const [file, setFile] = useState<File | null>(null);
  const [payer, setPayer] = useState("");
  const [txn, setTxn] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["public-payment", token],
    queryFn: () => fetchP({ data: { token } }),
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Please attach a payment screenshot");
      if (file.size > 7 * 1024 * 1024) throw new Error("File too large (max 7 MB)");
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const file_base64 = btoa(binary);
      const up = await upload({ data: { token, filename: file.name, content_type: file.type || "application/octet-stream", file_base64 } });
      if (!up.ok) throw new Error(up.error || "Upload failed");
      return submit({ data: { token, file_path: up.path, payer_name: payer || undefined, note: note || undefined, transaction_reference: txn || undefined } });
    },
    onSuccess: () => { setDone(true); toast.success("Sent — team will confirm shortly"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="min-h-dvh grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data?.payment) return <div className="min-h-dvh grid place-items-center text-sm text-muted-foreground">Payment link not found.</div>;
  const { payment, lead, company } = data;

  return (
    <div className="min-h-dvh bg-muted/30 py-6 px-4">
      <div className="max-w-md mx-auto bg-card border rounded-lg shadow-sm overflow-hidden">
        <header className="p-5 border-b flex items-center gap-3">
          {company?.logo_url ? (
            <img src={company.logo_url} alt="" className="h-10 w-10 rounded object-cover" />
          ) : (
            <div className="h-10 w-10 rounded bg-primary/10 grid place-items-center"><IndianRupee className="h-5 w-5 text-primary" /></div>
          )}
          <div className="min-w-0">
            <div className="font-semibold">{company?.name}</div>
            <div className="text-xs text-muted-foreground">Payment for {lead?.full_name}</div>
          </div>
        </header>

        <section className="p-5 border-b">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Amount due</div>
          <div className="text-2xl font-semibold">{formatINR(Number(payment.amount))}</div>
          {company?.upi_id && (
            <div className="mt-3 text-xs text-muted-foreground">
              UPI: <span className="font-mono text-foreground">{company.upi_id}</span>
            </div>
          )}
          {company?.bank_account && (
            <div className="text-xs text-muted-foreground">
              A/C: <span className="font-mono text-foreground">{company.bank_account}</span> · IFSC: <span className="font-mono text-foreground">{company.ifsc}</span>
            </div>
          )}
        </section>

        <section className="p-5">
          {done || payment.proof_url ? (
            <div className="flex items-start gap-2 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                Proof received — thank you!<br />
                <span className="font-normal text-muted-foreground text-xs">The team will confirm once verified.</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Payment screenshot *</Label>
                <Input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Paid by (name)</Label>
                <Input value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="Your name" maxLength={200} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Transaction reference (UTR/UPI ref)</Label>
                <Input value={txn} onChange={(e) => setTxn(e.target.value)} placeholder="Optional" maxLength={200} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Note</Label>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" maxLength={1000} />
              </div>
              <Button
                onClick={() => mut.mutate()}
                disabled={mut.isPending || !file}
                className="w-full min-h-11"
              >
                {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 mr-1.5" /> Submit proof</>}
              </Button>
              <div className="text-[11px] text-muted-foreground text-center">
                Need help? Contact {company?.wa_number ?? "the team"}.
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
