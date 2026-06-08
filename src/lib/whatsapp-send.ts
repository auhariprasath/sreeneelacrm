import { sendWhatsAppViaApi } from "@/lib/whatsapp.functions";
import { buildWaMeLink } from "@/lib/utils";
import { toast } from "sonner";

export type WhatsAppMode = "device" | "api";

/** Send a WhatsApp message either by opening wa.me on the user's device, or via the configured API. */
export async function sendWhatsApp(
  mode: WhatsAppMode,
  phone: string | null | undefined,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!phone) {
    toast.error("No phone number on file");
    return { ok: false, error: "no_phone" };
  }
  if (mode === "device") {
    const url = buildWaMeLink(phone, message);
    if (!url) {
      toast.error("Invalid phone number");
      return { ok: false, error: "invalid_phone" };
    }
    window.open(url, "_blank", "noopener");
    return { ok: true };
  }
  try {
    await sendWhatsAppViaApi({ data: { phone, message } });
    toast.success("WhatsApp sent via API");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Couldn't send via API";
    toast.error(msg);
    return { ok: false, error: msg };
  }
}
