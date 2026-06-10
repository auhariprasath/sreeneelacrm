const STORAGE_KEY = "neela-accent";

interface ColorTheme {
  label: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  sidebar: string;
  ring: string;
}

export const COLOR_THEMES: Record<string, ColorTheme> = {
  purple: {
    label: "Purple",
    primary: "#534AB7",
    primaryDark: "#3C3489",
    primaryLight: "#EEEDFE",
    sidebar: "#1E1B3A",
    ring: "#534AB7",
  },
  blue: {
    label: "Blue",
    primary: "#2563EB",
    primaryDark: "#1D4ED8",
    primaryLight: "#DBEAFE",
    sidebar: "#1E3A5F",
    ring: "#2563EB",
  },
  teal: {
    label: "Teal",
    primary: "#0D9488",
    primaryDark: "#0F766E",
    primaryLight: "#CCFBF1",
    sidebar: "#134E4A",
    ring: "#0D9488",
  },
  rose: {
    label: "Rose",
    primary: "#E11D48",
    primaryDark: "#BE123C",
    primaryLight: "#FFE4E6",
    sidebar: "#4C0519",
    ring: "#E11D48",
  },
  slate: {
    label: "Slate",
    primary: "#475569",
    primaryDark: "#334155",
    primaryLight: "#F1F5F9",
    sidebar: "#1E293B",
    ring: "#475569",
  },
};

export function applyStoredThemeColor() {
  if (typeof document === "undefined") return;
  const key = localStorage.getItem(STORAGE_KEY) ?? "purple";
  applyTheme(key);
}

function applyTheme(key: string) {
  const theme = COLOR_THEMES[key];
  if (!theme) return;
  const root = document.documentElement;
  root.style.setProperty("--primary", theme.primary);
  root.style.setProperty("--primary-dark", theme.primaryDark);
  root.style.setProperty("--primary-light", theme.primaryLight);
  root.style.setProperty("--ring", theme.ring);
  root.style.setProperty("--sidebar", theme.sidebar);
  root.style.setProperty("--sidebar-primary", theme.primary);
  root.style.setProperty("--sidebar-ring", theme.ring);
  // Light mode muted/accent = primaryLight
  if (!document.documentElement.classList.contains("dark")) {
    root.style.setProperty("--muted", theme.primaryLight);
    root.style.setProperty("--accent", theme.primaryLight);
    root.style.setProperty("--secondary", theme.primaryLight);
  }
}

export function ThemeColorPicker() {
  const stored = typeof localStorage !== "undefined" ? (localStorage.getItem(STORAGE_KEY) ?? "purple") : "purple";

  const pick = (key: string) => {
    localStorage.setItem(STORAGE_KEY, key);
    applyTheme(key);
    // Force re-render via a small DOM event
    window.dispatchEvent(new Event("themechange"));
  };

  return (
    <div className="flex items-center gap-1.5" title="Accent colour">
      {Object.entries(COLOR_THEMES).map(([key, theme]) => (
        <button
          key={key}
          type="button"
          onClick={() => pick(key)}
          title={theme.label}
          className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${
            stored === key ? "border-white scale-110 shadow-md" : "border-transparent"
          }`}
          style={{ backgroundColor: theme.primary }}
          aria-label={`Theme: ${theme.label}`}
        />
      ))}
    </div>
  );
}
