import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Build a WhatsApp deep link. Uses web.whatsapp.com on desktop (avoids the
 * api.whatsapp.com redirect that some networks/browsers block), and wa.me on
 * mobile so the native app opens. Normalises Indian phone numbers (defaults +91).
 * Returns null if no usable phone. */
export function buildWaMeLink(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const intl = digits.length === 10 ? `91${digits}` : digits;

  const isMobile = typeof navigator !== "undefined"
    && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

  if (isMobile) {
    const url = `https://wa.me/${intl}`;
    return message ? `${url}?text=${encodeURIComponent(message)}` : url;
  }

  // Desktop: open WhatsApp Web directly — bypasses the api.whatsapp.com gateway
  const base = `https://web.whatsapp.com/send?phone=${intl}`;
  return message ? `${base}&text=${encodeURIComponent(message)}` : base;
}

