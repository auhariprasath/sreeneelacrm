import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, KeyRound, LogOut, Sun, Moon, ClipboardList, CalendarDays, BarChart3, ArrowRightLeft, Megaphone, Shield } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/more")({
  component: MorePage,
});

function MorePage() {
  const { profile, role, companies, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const roleLabel = role === "super_admin" ? "Super Admin" : role === "admin" ? "Admin" : "Staff";

  return (
    <div className="space-y-4 max-w-lg">
      <Card className="p-4">
        <div className="font-semibold">{profile?.full_name}</div>
        <div className="text-sm text-muted-foreground">{profile?.email}</div>
        <div className="mt-1 text-xs">{roleLabel} · {companies[0]?.name ?? "All companies"}</div>
      </Card>

      <div className="space-y-2">
        <Link to="/bookings" className="block">
          <Button variant="outline" className="w-full justify-start min-h-[48px]"><ClipboardList className="h-4 w-4 mr-2" />Bookings</Button>
        </Link>
        <Link to="/calendar" className="block">
          <Button variant="outline" className="w-full justify-start min-h-[48px]"><CalendarDays className="h-4 w-4 mr-2" />Calendar</Button>
        </Link>
        <Link to="/reports" className="block">
          <Button variant="outline" className="w-full justify-start min-h-[48px]"><BarChart3 className="h-4 w-4 mr-2" />Reports</Button>
        </Link>
        <Link to="/transfers" className="block">
          <Button variant="outline" className="w-full justify-start min-h-[48px]"><ArrowRightLeft className="h-4 w-4 mr-2" />Transfers</Button>
        </Link>
        <Link to="/campaigns" className="block">
          <Button variant="outline" className="w-full justify-start min-h-[48px]"><Megaphone className="h-4 w-4 mr-2" />Campaigns</Button>
        </Link>
        {(role === "super_admin" || role === "admin") && (
          <Link to="/settings" className="block">
            <Button variant="outline" className="w-full justify-start min-h-[48px]"><Settings className="h-4 w-4 mr-2" />Settings</Button>
          </Link>
        )}
        <Button variant="outline" className="w-full justify-start min-h-[48px]" onClick={toggle}>
          {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
          Theme: {theme === "dark" ? "Dark" : "Light"}
        </Button>
        <Button variant="outline" className="w-full justify-start min-h-[48px]" onClick={() => navigate({ to: "/change-password" })}>
          <KeyRound className="h-4 w-4 mr-2" />Change password
        </Button>
        <Button
          variant="destructive"
          className="w-full justify-start min-h-[48px]"
          onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
        >
          <LogOut className="h-4 w-4 mr-2" />Sign out
        </Button>
      </div>
    </div>
  );
}
