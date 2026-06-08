import { buildWaMeLink } from "@/lib/utils";
import { toast } from "sonner";

export type WhatsAppMode = "device";

/** Open WhatsApp on the user's device via wa.me. */
export async function sendWhatsApp(
  _mode: WhatsAppMode,
  phone: string | null | undefined,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!phone) {
    toast.error("No phone number on file");
    return { ok: false, error: "no_phone" };
  }
  const url = buildWaMeLink(phone, message);
  if (!url) {
    toast.error("Invalid phone number");
    return { ok: false, error: "invalid_phone" };
  }
  window.open(url, "_blank", "noopener");
  return { ok: true };
}
