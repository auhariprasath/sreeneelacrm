import { useEffect, useState } from "react";

export function useCountdown(target: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target) return { expired: true, label: "", ms: 0 };
  const ms = new Date(target).getTime() - now;
  if (ms <= 0) return { expired: true, label: "0:00", ms: 0 };
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { expired: false, label: `${m}:${String(s).padStart(2, "0")}`, ms };
}
