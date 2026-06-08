import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { sendWhatsApp, type WhatsAppMode } from "@/lib/whatsapp-send";

interface Props {
  phone: string | null | undefined;
  message: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  /** Called after a successful send. */
  onSent?: (mode: WhatsAppMode) => void | Promise<void>;
}

/** Opens WhatsApp on the user's device (wa.me). */
export function WhatsAppSendButton({ phone, message, disabled, className, label = "WhatsApp", variant = "default", onSent }: Props) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const r = await sendWhatsApp("device", phone, message);
      if (r.ok) await onSent?.("device");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      disabled={disabled || busy}
      onClick={run}
      className={`${variant === "default" ? "bg-success hover:bg-success text-white" : ""} ${className ?? ""}`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <MessageCircle className="h-4 w-4 mr-1" />}
      {label}
    </Button>
  );
}
