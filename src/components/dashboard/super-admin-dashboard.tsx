import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CombinedCalendar } from "./combined-calendar";
import { StatsRow } from "./stats-row";
import { EmergencyAlerts } from "./emergency-alerts";
import { CompanyPanel } from "./company-panel";
import { PostEventPanel } from "./post-event-panel";
import { RightSidebar } from "./right-sidebar";
import { Calendar, BarChart3, Building2, Star, ListTodo } from "lucide-react";

interface CompanyRow { id: string; name: string; brand_color: string | null }

const TABS = [
  { id: "calendar", label: "Cal", icon: Calendar },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "companies", label: "Companies", icon: Building2 },
  { id: "feedback", label: "Feedback", icon: Star },
  { id: "todo", label: "To-do", icon: ListTodo },
];

function scrollTo(id: string) {
  const el = document.getElementById(`sa-${id}`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function SuperAdminDashboard() {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);

  const load = async () => {
    const { data } = await supabase.from("companies")
      .select("id, name, brand_color").is("deleted_at", null).order("name");
    setCompanies((data ?? []) as CompanyRow[]);
  };
  useEffect(() => { load(); }, []);
  useDashboardRealtime(["companies"], load);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 max-w-[1400px] pb-20 lg:pb-0">
        <div className="space-y-6 min-w-0">
          <div>
            <h1 className="text-2xl font-semibold">Welcome, {profile?.full_name || "there"}</h1>
            <p className="text-sm text-muted-foreground">All companies overview</p>
          </div>
          <div id="sa-calendar" className="scroll-mt-20"><CombinedCalendar /></div>
          <div id="sa-stats" className="scroll-mt-20 space-y-4">
            <StatsRow />
            <EmergencyAlerts />
          </div>
          <div id="sa-companies" className="scroll-mt-20 space-y-4">
            {companies.map((c) => (
              <CompanyPanel key={c.id} companyId={c.id} companyName={c.name} brandColor={c.brand_color || "#6366f1"} />
            ))}
          </div>
          <div id="sa-feedback" className="scroll-mt-20"><PostEventPanel /></div>
          {/* Mobile: surface the sidebar inline below feedback */}
          <div id="sa-todo" className="scroll-mt-20 lg:hidden"><RightSidebar /></div>
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-4"><RightSidebar /></div>
        </aside>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="grid grid-cols-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => scrollTo(t.id)}
              className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
