import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface Props {
  value: string; // "HH:MM" 24h
  onChange: (v: string) => void;
  onConfirm?: (v: string) => void;
  className?: string;
}

/**
 * Circular clock picker — tap hour then minute.
 * Large tap targets, AM/PM toggle, purple confirm button.
 */
export function TimeClockPicker({ value, onChange, onConfirm, className }: Props) {
  const initial = parseTime(value);
  const [mode, setMode] = React.useState<"hour" | "minute">("hour");
  const [hour24, setHour24] = React.useState(initial.h);
  const [minute, setMinute] = React.useState(initial.m);

  // Sync external value changes
  React.useEffect(() => {
    const p = parseTime(value);
    setHour24(p.h); setMinute(p.m);
  }, [value]);

  const isPM = hour24 >= 12;
  const hour12 = ((hour24 + 11) % 12) + 1;

  const commit = (h: number, m: number) => {
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    onChange(`${hh}:${mm}`);
  };

  const pickHour = (h12: number) => {
    const h24 = isPM ? (h12 === 12 ? 12 : h12 + 12) : (h12 === 12 ? 0 : h12);
    setHour24(h24); commit(h24, minute);
    setMode("minute");
  };
  const pickMinute = (m: number) => { setMinute(m); commit(hour24, m); };
  const setMeridiem = (pm: boolean) => {
    let h = hour24 % 12; if (pm) h += 12;
    setHour24(h); commit(h, minute);
  };

  // Geometry
  const size = 260; const cx = size / 2; const cy = size / 2; const r = 102; const itemR = 22;
  const hourLabels = Array.from({ length: 12 }, (_, i) => i + 1);
  const minuteLabels = Array.from({ length: 12 }, (_, i) => i * 5);

  const renderItems = () => {
    const items = mode === "hour" ? hourLabels : minuteLabels;
    return items.map((n, i) => {
      const angle = ((i / 12) * 2 * Math.PI) - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      const selected = mode === "hour" ? n === hour12 : n === minute;
      return (
        <button
          key={n}
          type="button"
          aria-label={mode === "hour" ? `Hour ${n}` : `Minute ${n}`}
          onClick={() => mode === "hour" ? pickHour(n) : pickMinute(n)}
          className={cn(
            "absolute flex items-center justify-center rounded-full text-base font-semibold transition-colors select-none",
            selected ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-accent text-foreground",
          )}
          style={{
            left: x - itemR, top: y - itemR,
            width: itemR * 2, height: itemR * 2,
          }}
        >
          {mode === "minute" ? String(n).padStart(2, "0") : n}
        </button>
      );
    });
  };

  // Hand line
  const selectedIdx = mode === "hour" ? hour12 - 1 : minute / 5;
  const angle = ((selectedIdx / 12) * 2 * Math.PI) - Math.PI / 2;
  const handX = cx + (r - 6) * Math.cos(angle);
  const handY = cy + (r - 6) * Math.sin(angle);

  const displayTime = `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* Digital display + AM/PM */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMode("hour")}
          className={cn(
            "px-3 py-2 rounded-md text-3xl font-bold tabular-nums tracking-tight transition-colors",
            mode === "hour" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {String(hour12).padStart(2, "0")}
        </button>
        <span className="text-3xl font-bold text-muted-foreground">:</span>
        <button
          type="button"
          onClick={() => setMode("minute")}
          className={cn(
            "px-3 py-2 rounded-md text-3xl font-bold tabular-nums tracking-tight transition-colors",
            mode === "minute" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {String(minute).padStart(2, "0")}
        </button>
        <div className="ml-2 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setMeridiem(false)}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded border min-h-[28px]",
              !isPM ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground",
            )}
          >AM</button>
          <button
            type="button"
            onClick={() => setMeridiem(true)}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded border min-h-[28px]",
              isPM ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground",
            )}
          >PM</button>
        </div>
      </div>

      {/* Clock face */}
      <div className="relative bg-muted/40 rounded-full" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0 pointer-events-none">
          <circle cx={cx} cy={cy} r={4} fill="var(--primary)" />
          <line x1={cx} y1={cy} x2={handX} y2={handY} stroke="var(--primary)" strokeWidth={2} />
          <circle cx={handX} cy={handY} r={3} fill="var(--primary)" />
        </svg>
        {renderItems()}
      </div>

      <div className="text-xs text-muted-foreground">
        {mode === "hour" ? "Tap an hour" : "Tap minutes"} · {displayTime} {isPM ? "PM" : "AM"}
      </div>

      {onConfirm && (
        <Button
          type="button"
          onClick={() => onConfirm(value)}
          className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
        >
          <Check className="h-4 w-4 mr-2" /> Confirm time
        </Button>
      )}
    </div>
  );
}

function parseTime(v: string): { h: number; m: number } {
  const [hh, mm] = (v || "00:00").split(":");
  const h = Math.min(23, Math.max(0, parseInt(hh || "0", 10) || 0));
  const raw = Math.min(59, Math.max(0, parseInt(mm || "0", 10) || 0));
  // Snap to nearest 5 minutes for the clock
  const m = Math.round(raw / 5) * 5 % 60;
  return { h, m };
}

/**
 * Popover trigger button + clock picker, drop-in replacement for <Input type="time">.
 */
export function TimeClockField({
  value, onChange, placeholder = "Pick time", className, disabled,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; className?: string; disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => { setDraft(value); }, [value]);

  const display = value ? formatDisplay(value) : "";

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !display && "text-muted-foreground",
          className,
        )}
      >
        <span>{display || placeholder}</span>
        <svg className="h-4 w-4 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx={12} cy={12} r={9} /><path d="M12 7v5l3 2" />
        </svg>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-popover rounded-lg shadow-xl p-5 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <TimeClockPicker
              value={draft}
              onChange={setDraft}
              onConfirm={() => { onChange(draft); setOpen(false); }}
            />
          </div>
        </div>
      )}
    </>
  );
}

function formatDisplay(v: string): string {
  const { h, m } = parseTime(v);
  const isPM = h >= 12;
  const h12 = ((h + 11) % 12) + 1;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${isPM ? "PM" : "AM"}`;
}
