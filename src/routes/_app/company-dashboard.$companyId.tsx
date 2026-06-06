import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CompanyPanel } from "@/components/dashboard/company-panel";
import { RightSidebar } from "@/components/dashboard/right-sidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings } from "lucide-react";

export const Route = createFileRoute("/_app/company-dashboard/$companyId")({
  component: CompanyDashboardPage,
});

interface Company { id: string; name: string; brand_color: string | null }

function CompanyDashboardPage() {
  const { companyId } = Route.useParams();
  const { role } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name, brand_color")
        .eq("id", companyId)
        .is("deleted_at", null)
        .maybeSingle();
      if (active) {
        setCompany((data as Company) ?? null);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [companyId]);

  if (role !== "super_admin") return <Navigate to="/dashboard" replace />;
  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!company) return <div className="text-sm text-muted-foreground">Company not found.</div>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 max-w-[1400px]">
      <div className="space-y-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> All companies</Button>
            </Link>
            <h1 className="text-xl sm:text-2xl font-semibold truncate">{company.name}</h1>
          </div>
          <Link to="/company-settings/$companyId" params={{ companyId: company.id }}>
            <Button variant="outline" size="sm"><Settings className="h-4 w-4 mr-1" /> Company settings</Button>
          </Link>
        </div>
        <CompanyPanel
          companyId={company.id}
          companyName={company.name}
          brandColor={company.brand_color || "#6366f1"}
        />
      </div>
      <aside className="hidden xl:block">
        <div className="sticky top-4"><RightSidebar /></div>
      </aside>
    </div>
  );
}
