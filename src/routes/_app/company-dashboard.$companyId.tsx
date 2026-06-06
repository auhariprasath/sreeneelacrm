import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CompanyOverviewView } from "@/components/dashboard/company-overview-view";
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
    <div className="space-y-5 max-w-[1500px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> All companies</Button>
          </Link>
          <span className="h-3 w-3 rounded-full shrink-0" style={{ background: company.brand_color || "hsl(var(--primary))" }} />
          <h1 className="text-xl sm:text-2xl font-semibold truncate">{company.name}</h1>
        </div>
        <Link to="/company-settings/$companyId" params={{ companyId: company.id }}>
          <Button variant="outline" size="sm"><Settings className="h-4 w-4 mr-1" /> Company settings</Button>
        </Link>
      </div>
      <CompanyOverviewView companyId={company.id} />
    </div>
  );
}
