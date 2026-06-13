import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface PickerProps {
  value: string; // "HH:MM" 24h
  onChange: (v: string) => void;
  onConfirm?: (v: string) => void;
  className?: string;
}

export function TimeClockPicker({ value, onChange, onConfirm, className }: PickerProps) {
  const initial = parseTime(value);
  const [mode, setMode] = React.useState<"hour" | "minute">("hour");
  const [hour24, setHour24] = React.useState(initial.h);
  const [minute, setMinute] = React.useState(initial.m);

  React.useEffect(() => {
    const p = parseTime(value);
    setHour24(p.h);
    setMinute(p.m);
  }, [value]);

  const isPM = hour24 >= 12;
  const hour12 = ((hour24 + 11) % 12) + 1;

  const commit = (h: number, m: number) => {
    onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  };

  const pickHour = (h12: number) => {
    const h24 = isPM ? (h12 === 12 ? 12 : h12 + 12) : (h12 === 12 ? 0 : h12);
    setHour24(h24);
    commit(h24, minute);
    setMode("minute");
  };

  const pickMinute = (m: number) => {
    setMinute(m);
    const v = `${String(hour24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    onChange(v);
    onConfirm?.(v);
  };

  const setMeridiem = (pm: boolean) => {
    let h = hour24 % 12;
    if (pm) h += 12;
    setHour24(h);
    commit(h, minute);
  };

  // Clock geometry
  const size = 256;
  const cx = size / 2;
  const cy = size / 2;
  const r = 100;
  const itemR = 22;

  const hourLabels = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minuteLabels = Array.from({ length: 12 }, (_, i) => i * 5);

  const renderItems = () => {
    const items = mode === "hour" ? hourLabels : minuteLabels;
    return items.map((n, i) => {
      const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      const selected = mode === "hour" ? n === hour12 : n === minute;
      return (
        <button
          key={n}
          type="button"
          onClick={() => mode === "hour" ? pickHour(n) : pickMinute(n)}
          className={cn(
            "absolute flex items-center justify-center rounded-full text-sm font-semibold transition-colors select-none",
            selected
              ? "bg-primary text-primary-foreground shadow"
              : "text-foreground hover:bg-accent",
          )}
          style={{
            left: x - itemR,
            top: y - itemR,
            width: itemR * 2,
            height: itemR * 2,
          }}
        >
          {mode === "minute" ? String(n).padStart(2, "0") : n}
        </button>
      );
    });
  };

  // Clock hand
  const selectedVal = mode === "hour" ? hourLabels.indexOf(hour12) : minute / 5;
  const handAngle = (selectedVal / 12) * 2 * Math.PI - Math.PI / 2;
  const handX = cx + (r - 8) * Math.cos(handAngle);
  const handY = cy + (r - 8) * Math.sin(handAngle);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Digital display + AM/PM */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("hour")}
          className={cn(
            "px-3 py-1.5 rounded-md text-3xl font-bold tabular-nums transition-colors",
            mode === "hour"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          {String(hour12).padStart(2, "0")}
        </button>
        <span className="text-3xl font-bold text-muted-foreground">:</span>
        <button
          type="button"
          onClick={() => setMode("minute")}
          className={cn(
            "px-3 py-1.5 rounded-md text-3xl font-bold tabular-nums transition-colors",
            mode === "minute"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          {String(minute).padStart(2, "0")}
        </button>
        <div className="flex flex-col gap-1 ml-2">
          <button
            type="button"
            onClick={() => setMeridiem(false)}
            className={cn(
              "px-2.5 py-0.5 text-xs font-semibold rounded border",
              !isPM
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border",
            )}
          >AM</button>
          <button
            type="button"
            onClick={() => setMeridiem(true)}
            className={cn(
              "px-2.5 py-0.5 text-xs font-semibold rounded border",
              isPM
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border",
            )}
          >PM</button>
        </div>
      </div>

      {/* Clock face */}
      <div
        className="relative rounded-full bg-muted/40"
        style={{ width: size, height: size }}
      >
        {/* SVG hand — pointer-events-none so it never blocks clicks */}
        <svg
          width={size}
          height={size}
          className="absolute inset-0 pointer-events-none"
        >
          <circle cx={cx} cy={cy} r={4} fill="var(--primary)" />
          <line
            x1={cx} y1={cy}
            x2={handX} y2={handY}
            stroke="var(--primary)"
            strokeWidth={2}
          />
          <circle cx={handX} cy={handY} r={4} fill="var(--primary)" />
        </svg>
        {renderItems()}
      </div>

      <p className="text-xs text-muted-foreground">
        {mode === "hour" ? "Tap an hour" : "Tap a minute"} &middot;{" "}
        {String(hour12).padStart(2, "0")}:{String(minute).padStart(2, "0")}{" "}
        {isPM ? "PM" : "AM"}
      </p>

    </div>
  );
}

function parseTime(v: string): { h: number; m: number } {
  const [hh, mm] = (v || "00:00").split(":");
  const h = Math.min(23, Math.max(0, parseInt(hh || "0", 10) || 0));
  const raw = Math.min(59, Math.max(0, parseInt(mm || "0", 10) || 0));
  const m = Math.round(raw / 5) * 5 % 60;
  return { h, m };
}

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

      {/* Uses shadcn Dialog so Radix handles the portal — no stacking/transform issues */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) { onChange(draft); } setOpen(o); }}>
        <DialogContent className="max-w-xs p-5 [&>button:last-child]:hidden">
          <TimeClockPicker
            value={draft}
            onChange={setDraft}
            onConfirm={(v) => { onChange(v); setOpen(false); }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatDisplay(v: string): string {
  const { h, m } = parseTime(v);
  const isPM = h >= 12;
  const h12 = ((h + 11) % 12) + 1;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${isPM ? "PM" : "AM"}`;
}
