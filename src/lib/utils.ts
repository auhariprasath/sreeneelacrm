import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Build a WhatsApp send link. Normalises Indian phone numbers (defaults +91). Returns null if no usable phone.
 *  Uses web.whatsapp.com/send directly so the browser decodes the text via JS (preserving emojis & newlines).
 *  wa.me goes through a native-app redirect on Windows that corrupts multi-byte emoji sequences. */
export function buildWaMeLink(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const intl = digits.length === 10 ? `91${digits}` : digits;
  if (message) {
    return `https://web.whatsapp.com/send?phone=${intl}&text=${encodeURIComponent(message)}`;
  }
  return `https://web.whatsapp.com/send?phone=${intl}`;
}

export function openWaMeLink(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

