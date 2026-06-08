import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, MessageCircle, Send, Smartphone, Loader2 } from "lucide-react";
import { useState } from "react";
import { sendWhatsApp, type WhatsAppMode } from "@/lib/whatsapp-send";

interface Props {
  phone: string | null | undefined;
  message: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  /** Called after a successful send for either mode. */
  onSent?: (mode: WhatsAppMode) => void | Promise<void>;
}

/** Split button: primary action opens WhatsApp on the user's device,
 *  dropdown offers "Send via API" (Twilio) without leaving the app. */
export function WhatsAppSendButton({ phone, message, disabled, className, label = "WhatsApp", variant = "default", onSent }: Props) {
  const [busy, setBusy] = useState<WhatsAppMode | null>(null);

  const run = async (mode: WhatsAppMode) => {
    setBusy(mode);
    try {
      const r = await sendWhatsApp(mode, phone, message);
      if (r.ok) await onSent?.(mode);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`inline-flex ${className ?? ""}`}>
      <Button
        type="button"
        variant={variant}
        disabled={disabled || busy !== null}
        onClick={() => run("device")}
        className={variant === "default" ? "bg-success hover:bg-success text-white rounded-r-none" : "rounded-r-none"}
      >
        {busy === "device" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <MessageCircle className="h-4 w-4 mr-1" />}
        {label}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={variant}
            disabled={disabled || busy !== null}
            className={variant === "default" ? "bg-success hover:bg-success text-white rounded-l-none border-l border-white/20 px-2" : "rounded-l-none border-l px-2"}
            aria-label="More WhatsApp options"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => run("device")} disabled={busy !== null}>
            <Smartphone className="h-4 w-4 mr-2" />
            Open WhatsApp on this device
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("api")} disabled={busy !== null}>
            {busy === "api" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send via API (Twilio)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
