import { useEffect, useState } from "react";
import { Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Preset {
  name: string;
  hex: string;     // for swatch
  primary: string; // oklch
  ring: string;
  accent: string;
  accentFg: string;
}

const PRESETS: Preset[] = [
  { name: "Indigo",  hex: "#534AB7", primary: "oklch(0.46 0.16 282)", ring: "oklch(0.46 0.16 282)", accent: "oklch(0.95 0.03 282)", accentFg: "oklch(0.30 0.08 282)" },
  { name: "Teal",    hex: "#14b8a6", primary: "oklch(0.70 0.13 180)", ring: "oklch(0.70 0.13 180)", accent: "oklch(0.95 0.04 180)", accentFg: "oklch(0.35 0.10 180)" },
  { name: "Emerald", hex: "#10b981", primary: "oklch(0.68 0.15 160)", ring: "oklch(0.68 0.15 160)", accent: "oklch(0.95 0.04 160)", accentFg: "oklch(0.34 0.10 160)" },
  { name: "Blue",    hex: "#2563eb", primary: "oklch(0.55 0.20 255)", ring: "oklch(0.55 0.20 255)", accent: "oklch(0.95 0.04 255)", accentFg: "oklch(0.32 0.12 255)" },
  { name: "Rose",    hex: "#e11d48", primary: "oklch(0.60 0.21 18)",  ring: "oklch(0.60 0.21 18)",  accent: "oklch(0.95 0.04 18)",  accentFg: "oklch(0.36 0.12 18)"  },
  { name: "Amber",   hex: "#d97706", primary: "oklch(0.70 0.16 60)",  ring: "oklch(0.70 0.16 60)",  accent: "oklch(0.95 0.05 60)",  accentFg: "oklch(0.38 0.12 60)"  },
  { name: "Violet",  hex: "#7c3aed", primary: "oklch(0.55 0.22 295)", ring: "oklch(0.55 0.22 295)", accent: "oklch(0.95 0.04 295)", accentFg: "oklch(0.32 0.12 295)" },
  { name: "Slate",   hex: "#334155", primary: "oklch(0.35 0.03 260)", ring: "oklch(0.35 0.03 260)", accent: "oklch(0.94 0.01 260)", accentFg: "oklch(0.28 0.03 260)" },
];

const KEY = "app.themeColor";

function apply(p: Preset) {
  const r = document.documentElement.style;
  r.setProperty("--primary", p.primary);
  r.setProperty("--ring", p.ring);
  r.setProperty("--accent", p.accent);
  r.setProperty("--accent-foreground", p.accentFg);
  r.setProperty("--sidebar-primary", p.primary);
}

export function applyStoredThemeColor() {
  try {
    const name = localStorage.getItem(KEY);
    const p = PRESETS.find((x) => x.name === name);
    if (p) apply(p);
  } catch {}
}

export function ThemeColorPicker() {
  const [active, setActive] = useState<string>(() => {
    try { return localStorage.getItem(KEY) ?? "Indigo"; } catch { return "Indigo"; }
  });

  useEffect(() => { applyStoredThemeColor(); }, []);

  const choose = (p: Preset) => {
    apply(p);
    localStorage.setItem(KEY, p.name);
    setActive(p.name);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Theme color">
          <Palette className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="text-xs font-medium text-muted-foreground mb-2">Accent color</div>
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((p) => {
            const selected = active === p.name;
            return (
              <button
                key={p.name}
                onClick={() => choose(p)}
                title={p.name}
                className="relative h-10 w-full rounded-md border hover:scale-[1.04] transition-transform"
                style={{ backgroundColor: p.hex }}
              >
                {selected && (
                  <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
