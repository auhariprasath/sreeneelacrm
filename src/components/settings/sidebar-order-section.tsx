import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { GripVertical, Eye, EyeOff } from "lucide-react";
import {
  LayoutDashboard, Users, ClipboardList, FileText, CalendarDays,
  PhoneCall, KanbanSquare, Megaphone, MapPin, Star, UserX,
  MessageSquare, BarChart3, ArrowRightLeft, Settings, TrendingUp,
} from "lucide-react";

export const ALL_NAV_ITEMS = [
  { key: "dashboard",      label: "Dashboard",       icon: LayoutDashboard },
  { key: "leads",          label: "Leads",            icon: Users },
  { key: "bookings",       label: "Bookings",         icon: ClipboardList },
  { key: "quotations",     label: "Quotations",       icon: FileText },
  { key: "calendar",       label: "Calendar",         icon: CalendarDays },
  { key: "follow-ups",     label: "Follow-ups",       icon: PhoneCall },
  { key: "tasks",          label: "Task Board",       icon: KanbanSquare },
  { key: "campaigns",      label: "Campaigns",        icon: Megaphone },
  { key: "venue-meetings", label: "Venue Meetings",   icon: MapPin },
  { key: "customers",      label: "Customers",        icon: Star },
  { key: "not-interested", label: "Not Interested",   icon: UserX },
  { key: "stale-leads",    label: "Stale Leads",      icon: MessageSquare },
  { key: "analytics",      label: "Analytics",        icon: TrendingUp },
  { key: "reports",        label: "Reports",          icon: BarChart3 },
  { key: "transfers",      label: "Transfers",        icon: ArrowRightLeft },
  { key: "settings",       label: "Settings",         icon: Settings },
] as const;

export type NavKey = (typeof ALL_NAV_ITEMS)[number]["key"];

const STORAGE_KEY = "crm_sidebar_order";

export function getSidebarPrefs(): { order: NavKey[]; hidden: NavKey[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { order: NavKey[]; hidden: NavKey[] };
      const allKeys = ALL_NAV_ITEMS.map((i) => i.key);
      const saved = parsed.order.filter((k) => allKeys.includes(k as NavKey));
      const unsaved = allKeys.filter((k) => !saved.includes(k));
      return { order: [...saved, ...unsaved] as NavKey[], hidden: parsed.hidden ?? [] };
    }
  } catch {}
  return { order: ALL_NAV_ITEMS.map((i) => i.key), hidden: [] };
}

export function saveSidebarPrefs(prefs: { order: NavKey[]; hidden: NavKey[] }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function SidebarOrderSection() {
  const [items, setItems] = useState<NavKey[]>([]);
  const [hidden, setHidden] = useState<Set<NavKey>>(new Set());
  const [dragging, setDragging] = useState<NavKey | null>(null);
  const [dragOver, setDragOver] = useState<NavKey | null>(null);

  useEffect(() => {
    const prefs = getSidebarPrefs();
    // Merge: add any new keys not yet in saved order
    const saved = prefs.order.filter((k) => ALL_NAV_ITEMS.some((i) => i.key === k));
    const unsaved = ALL_NAV_ITEMS.map((i) => i.key).filter((k) => !saved.includes(k));
    setItems([...saved, ...unsaved]);
    setHidden(new Set(prefs.hidden as NavKey[]));
  }, []);

  const toggleHidden = (key: NavKey) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const onDragStart = (key: NavKey) => setDragging(key);
  const onDragOver = (e: React.DragEvent, key: NavKey) => {
    e.preventDefault();
    setDragOver(key);
  };
  const onDrop = (targetKey: NavKey) => {
    if (!dragging || dragging === targetKey) { setDragging(null); setDragOver(null); return; }
    setItems((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(dragging);
      const toIdx = next.indexOf(targetKey);
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, dragging);
      return next;
    });
    setDragging(null);
    setDragOver(null);
  };

  const save = () => {
    saveSidebarPrefs({ order: items, hidden: Array.from(hidden) as NavKey[] });
    toast.success("Sidebar order saved — refresh to see changes");
  };

  const reset = () => {
    const defaults = { order: ALL_NAV_ITEMS.map((i) => i.key), hidden: [] };
    saveSidebarPrefs(defaults);
    setItems(defaults.order);
    setHidden(new Set());
    toast.success("Reset to default order");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Drag to reorder. Click the eye icon to show or hide items from your sidebar.
      </p>

      <div className="space-y-1">
        {items.map((key) => {
          const item = ALL_NAV_ITEMS.find((i) => i.key === key)!;
          const Icon = item.icon;
          const isHidden = hidden.has(key);
          const isDragTarget = dragOver === key;

          return (
            <div
              key={key}
              draggable
              onDragStart={() => onDragStart(key)}
              onDragOver={(e) => onDragOver(e, key)}
              onDrop={() => onDrop(key)}
              onDragEnd={() => { setDragging(null); setDragOver(null); }}
              className={`flex items-center gap-3 px-3 py-2 rounded-md border bg-card cursor-grab transition-all
                ${isDragTarget ? "border-primary bg-accent" : "border-border"}
                ${isHidden ? "opacity-40" : ""}
                ${dragging === key ? "opacity-50" : ""}
              `}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-sm flex-1">{item.label}</span>
              <button
                type="button"
                onClick={() => toggleHidden(key)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title={isHidden ? "Show in sidebar" : "Hide from sidebar"}
              >
                {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button onClick={save}>Save order</Button>
        <Button variant="outline" onClick={reset}>Reset to default</Button>
      </div>
    </div>
  );
}
