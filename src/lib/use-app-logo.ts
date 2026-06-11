import { useEffect, useState } from "react";

const LS_KEY = "app_global_logo";
export const DEFAULT_LOGO = "/icon-192.png";

function applyFavicon(url: string) {
  const selectors = ['link[rel="icon"]', 'link[rel="apple-touch-icon"]'];
  selectors.forEach((sel) => {
    let el = document.querySelector<HTMLLinkElement>(sel);
    if (!el) {
      el = document.createElement("link");
      el.rel = sel.includes("apple") ? "apple-touch-icon" : "icon";
      document.head.appendChild(el);
    }
    el.href = url;
  });
}

export function getAppLogo(): string {
  try { return localStorage.getItem(LS_KEY) || DEFAULT_LOGO; } catch { return DEFAULT_LOGO; }
}

export function setAppLogo(url: string) {
  localStorage.setItem(LS_KEY, url);
  applyFavicon(url);
  window.dispatchEvent(new CustomEvent("app-logo-change", { detail: url }));
}

export function clearAppLogo() {
  localStorage.removeItem(LS_KEY);
  applyFavicon(DEFAULT_LOGO);
  window.dispatchEvent(new CustomEvent("app-logo-change", { detail: DEFAULT_LOGO }));
}

export function useAppLogo(): string {
  const [logo, setLogo] = useState<string>(getAppLogo);

  useEffect(() => {
    // Apply favicon on mount so it reflects any stored logo immediately
    applyFavicon(getAppLogo());

    const onCustom = (e: Event) => setLogo((e as CustomEvent).detail);
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) {
        const url = e.newValue || DEFAULT_LOGO;
        applyFavicon(url);
        setLogo(url);
      }
    };
    window.addEventListener("app-logo-change", onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("app-logo-change", onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return logo;
}
