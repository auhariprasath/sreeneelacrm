import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** True on Android phones/tablets. */
function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

/** True on iPhone / iPad / iPod. */
function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    // iPad OS 13+ reports itself as "MacIntel" but has touch points
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** True on any touch-primary mobile/tablet device. */
function isMobile(): boolean {
  return isAndroid() || isIOS() || /IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Build the best WhatsApp URL for the current device.
 *
 * Android  → Android Intent URI (bypasses the browser entirely, opens the
 *             installed WhatsApp app directly without any redirect page).
 * iOS      → whatsapp:// URI scheme (same effect on iOS).
 * Desktop  → web.whatsapp.com/send (opens WhatsApp Web in a new tab).
 *
 * Text is encoded with encodeURIComponent so newlines, emojis, and all
 * Unicode characters survive the URL round-trip correctly on every path.
 */
export function buildWaMeLink(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const intl = digits.length === 10 ? `91${digits}` : digits;
  const encoded = message ? encodeURIComponent(message) : "";

  if (isMobile()) {
    // wa.me is the official WhatsApp deep-link endpoint.
    // On Android/iOS it triggers the installed app directly (no WhatsApp Web login).
    // Opened via window.location.href (not window.open) so no new browser tab appears.
    return message
      ? `https://wa.me/${intl}?text=${encoded}`
      : `https://wa.me/${intl}`;
  }

  // Desktop: WhatsApp Web in a new tab.
  return message
    ? `https://web.whatsapp.com/send?phone=${intl}&text=${encoded}`
    : `https://web.whatsapp.com/send?phone=${intl}`;
}

/**
 * Open a WhatsApp link built by buildWaMeLink.
 *
 * Mobile  → window.location.href so the OS deep-link handler intercepts the
 *            URI and opens WhatsApp without spawning a new browser tab.
 * Desktop → window.open() so the user keeps their place in the CRM.
 */
export function openWaMeLink(url: string) {
  if (isMobile()) {
    window.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

