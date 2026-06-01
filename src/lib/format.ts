// Indian formatters

export function formatINR(n: number | null | undefined, opts?: { short?: boolean }): string {
  if (n == null || isNaN(n)) return "₹0";
  if (opts?.short) {
    if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(n % 1_00_00_000 === 0 ? 0 : 2)}Cr`;
    if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(n % 1_00_000 === 0 ? 0 : 2)}L`;
    if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}K`;
  }
  return "₹" + n.toLocaleString("en-IN");
}

export function formatDateIN(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

export function formatTime12(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  let h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

export function formatDateTimeIN(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return `${formatDateIN(d)}, ${formatTime12(d)}`;
}

export function formatPhoneIN(p: string | null | undefined, masked = false): string {
  if (!p) return "—";
  // Strip non-digits, keep last 10
  const digits = p.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  if (last10.length < 10) return p;
  if (masked) return `+91 XXXXX XX${last10.slice(-3)}`;
  return `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;
}

export function relativeTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDateIN(date);
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "U";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}
