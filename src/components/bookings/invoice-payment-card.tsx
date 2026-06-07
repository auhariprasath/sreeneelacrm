import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CheckCircle2, ChevronDown, CreditCard, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type Quotation = Database["public"]["Tables"]["quotations"]["Row"];
type PaymentMethod = "cash" | "cheque" | "bank_transfer" | "upi" | "razorpay";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "upi", label: "UPI" },
  { value: "razorpay", label: "Razorpay link" },
];

interface Props {
  quotation: Quotation;
  onPaymentReceived: (quotationId: string, method: PaymentMethod) => void;
  onChanged?: () => void;
}

export function InvoicePaymentCard({ quotation, onPaymentReceived, onChanged }: Props) {
  const selected = (quotation.selected_payment_method as PaymentMethod | null) ?? "cash";
  const [method, setMethod] = useState<PaymentMethod>(selected);
  const selectedLabel = METHODS.find((m) => m.value === method)?.label ?? "Cash";

  const changeMethod = async (m: PaymentMethod) => {
    setMethod(m);
    const { error } = await supabase
      .from("quotations")
      .update({ selected_payment_method: m })
      .eq("id", quotation.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Payment method set to ${METHODS.find((x) => x.value === m)?.label}`);
    onChanged?.();
  };

  return (
    <div className="bg-warning/5 border border-warning/30 rounded-md p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-3.5 w-3.5 text-warning" />
          <span className="font-medium">Invoice {quotation.invoice_number}</span>
          <span className="text-xs text-muted-foreground">· {formatINR(Number(quotation.total))}</span>
        </div>
        <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-warning/20 text-warning dark:text-warning">
          Payment not yet received
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CreditCard className="h-3.5 w-3.5" />
          Method:
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs">
                {selectedLabel} <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {METHODS.map((m) => (
                <DropdownMenuItem key={m.value} onClick={() => changeMethod(m.value)}>
                  {m.label}{m.value === method && " ✓"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button
          size="sm"
          onClick={() => onPaymentReceived(quotation.id, method)}
          className="bg-success hover:bg-success text-white"
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Payment received
        </Button>
      </div>
    </div>
  );
}
