import { createFileRoute, Outlet, Link, useNavigate, useRouterState, Navigate } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LayoutDashboard, Users, CalendarDays, ClipboardList, KanbanSquare, BarChart3, Settings, Moon, Sun, LogOut, KeyRound, Building2,
} from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/_app")({ component: AppLayout });

const NAV: { to: string; label: string; icon: any; roles: AppRole[] }[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["super_admin","admin","staff"] },
  { to: "/leads", label: "Leads", icon: Users, roles: ["super_admin","admin","staff"] },
  { to: "/bookings", label: "Bookings", icon: ClipboardList, roles: ["super_admin","admin","staff"] },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, roles: ["super_admin","admin","staff"] },
  { to: "/tasks", label: "Task Board", icon: KanbanSquare, roles: ["super_admin","admin","staff"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["super_admin","admin","staff"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["super_admin","admin"] },
];

function AppLayout() {
  const { loading, user, profile, role, companies, activeCompanyId, setActiveCompanyId, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && user && profile?.must_change_password && pathname !== "/change-password") {
      navigate({ to: "/change-password", replace: true });
    }
  }, [loading, user, profile, pathname, navigate]);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  const items = NAV.filter((n) => role && n.roles.includes(role));
  const roleLabel = role === "super_admin" ? "Super Admin" : role === "admin" ? "Admin" : "Staff";
  const initials = (profile?.full_name || profile?.email || "U").split(" ").map(s => s[0]).slice(0,2).join("").toUpperCase();

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded-md bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold">N</div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Neela Events</div>
            <div className="text-[11px] text-sidebar-foreground/60">CRM</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {items.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 text-[11px] text-sidebar-foreground/50 border-t border-sidebar-border">
          v0.1 · Phase 1
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card flex items-center gap-3 px-6">
          {role === "super_admin" && companies.length > 0 && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select
                value={activeCompanyId ?? "__all"}
                onValueChange={(v) => setActiveCompanyId(v === "__all" ? null : v)}
              >
                <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All companies</SelectItem>
                  {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {role !== "super_admin" && companies[0] && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              {companies[0].name}
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
                  <Avatar className="h-8 w-8"><AvatarFallback>{initials}</AvatarFallback></Avatar>
                  <div className="text-left leading-tight hidden sm:block">
                    <div className="text-sm font-medium">{profile?.full_name || profile?.email}</div>
                    <Badge variant="secondary" className="h-4 text-[10px] mt-0.5">{roleLabel}</Badge>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{profile?.full_name}</div>
                  <div className="text-xs text-muted-foreground">{profile?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/change-password" })}>
                  <KeyRound className="h-4 w-4 mr-2" /> Change password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
