import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  phone: z.string().min(6).max(20),
  message: z.string().min(1).max(4000),
});

function normalizeE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // Default to Indian numbers when 10 digits are provided
  const intl = digits.length === 10 ? `91${digits}` : digits;
  return `+${intl}`;
}

export const sendWhatsAppViaApi = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
    const FROM = process.env.TWILIO_WHATSAPP_FROM;

    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      throw new Error(
        "WhatsApp API is not configured. Connect Twilio in project settings to enable Send via API.",
      );
    }
    if (!FROM) {
      throw new Error(
        "TWILIO_WHATSAPP_FROM is not set. Add your Twilio WhatsApp sender (e.g. +14155238886) in project secrets.",
      );
    }

    const to = normalizeE164(data.phone);
    if (!to) throw new Error("Invalid phone number");

    const fromNumber = FROM.startsWith("+") ? FROM : `+${FROM.replace(/\D/g, "")}`;

    const body = new URLSearchParams({
      To: `whatsapp:${to}`,
      From: `whatsapp:${fromNumber}`,
      Body: data.message,
    });

    const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
    if (!res.ok) {
      throw new Error(json.message ?? `WhatsApp API error (${res.status})`);
    }
    return { sid: json.sid ?? null };
  });
