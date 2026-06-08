import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Build a native WhatsApp app link. Normalises Indian phone numbers (defaults +91). Returns null if no usable phone. */
export function buildWaMeLink(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  // If exactly 10 digits, assume Indian mobile and prefix 91
  const intl = digits.length === 10 ? `91${digits}` : digits;
  const url = `whatsapp://send?phone=${intl}`;
  if (message) return `${url}&text=${encodeURIComponent(message)}`;
  return url;
}

export function openWaMeLink(url: string) {
  window.location.href = url;
}

