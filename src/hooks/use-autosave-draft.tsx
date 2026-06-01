import { useEffect, useRef, useState } from "react";

const PREFIX = "neela-draft:";

export function useAutosaveDraft<T>(
  key: string,
  value: T,
  enabled = true,
): { savedAt: Date | null; clear: () => void } {
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const last = useRef<string>("");

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const serialized = JSON.stringify(value);
    if (serialized === last.current) return;
    const t = setTimeout(() => {
      localStorage.setItem(PREFIX + key, serialized);
      last.current = serialized;
      setSavedAt(new Date());
    }, 800);
    return () => clearTimeout(t);
  }, [key, value, enabled]);

  // Save also every 30s as fallback
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      const serialized = JSON.stringify(value);
      if (serialized !== last.current) {
        localStorage.setItem(PREFIX + key, serialized);
        last.current = serialized;
        setSavedAt(new Date());
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [key, value, enabled]);

  return {
    savedAt,
    clear: () => {
      if (typeof window !== "undefined") localStorage.removeItem(PREFIX + key);
      last.current = "";
      setSavedAt(null);
    },
  };
}

export function loadDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PREFIX + key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
