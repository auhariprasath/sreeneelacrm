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
  LayoutDashboard, Users, CalendarDays, ClipboardList, KanbanSquare, BarChart3, Settings, Moon, Sun, LogOut, KeyRound, Building2, Bell, MoreHorizontal,
} from "lucide-react";
import { useEffect } from "react";
import { OfflineBanner } from "@/components/offline-banner";
import { useSessionTimeout } from "@/hooks/use-session-timeout";
import { toast } from "sonner";
import { initialsOf } from "@/lib/format";
import { InstallPrompt } from "@/components/install-prompt";


export const Route = createFileRoute("/_app")({ component: AppLayout });

interface NavItem { to: string; label: string; icon: any; roles: AppRole[] }

const SIDEBAR_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["super_admin","admin","staff"] },
  { to: "/leads", label: "Leads", icon: Users, roles: ["super_admin","admin","staff"] },
  { to: "/bookings", label: "Bookings", icon: ClipboardList, roles: ["super_admin","admin","staff"] },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, roles: ["super_admin","admin","staff"] },
  { to: "/tasks", label: "Task Board", icon: KanbanSquare, roles: ["super_admin","admin","staff"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["super_admin","admin","staff"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["super_admin","admin"] },
];

// Mobile bottom nav: Dashboard | Leads | Tasks | Notifications | More
const BOTTOM_NAV: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, roles: ["super_admin","admin","staff"] },
  { to: "/leads", label: "Leads", icon: Users, roles: ["super_admin","admin","staff"] },
  { to: "/tasks", label: "Tasks", icon: KanbanSquare, roles: ["super_admin","admin","staff"] },
  { to: "/notifications", label: "Alerts", icon: Bell, roles: ["super_admin","admin","staff"] },
  { to: "/more", label: "More", icon: MoreHorizontal, roles: ["super_admin","admin","staff"] },
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

  useSessionTimeout(async () => {
    await signOut();
    toast.error("Session expired. Please log in.");
    navigate({ to: "/login", replace: true });
  }, !!user);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  const sidebarItems = SIDEBAR_NAV.filter((n) => role && n.roles.includes(role));
  const bottomItems = BOTTOM_NAV.filter((n) => role && n.roles.includes(role));
  const roleLabel = role === "super_admin" ? "Super Admin" : role === "admin" ? "Admin" : "Staff";
  const initials = initialsOf(profile?.full_name || profile?.email || "U");

  return (
    <div className="flex min-h-screen w-full bg-background flex-col md:flex-row">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex w-60 shrink-0 bg-sidebar text-sidebar-foreground flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded-md bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold">N</div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Neela Events</div>
            <div className="text-[11px] text-sidebar-foreground/60">CRM</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {sidebarItems.map((item) => {
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
          v0.2 · Phase 2
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <OfflineBanner />

        {/* Top header */}
        <header className="h-14 md:h-16 border-b bg-card flex items-center gap-2 md:gap-3 px-3 md:px-6 sticky top-0 z-30">
          {/* Mobile brand */}
          <div className="md:hidden flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">N</div>
            <span className="text-sm font-semibold">Neela CRM</span>
          </div>

          {role === "super_admin" && companies.length > 0 && (
            <div className="hidden md:flex items-center gap-2">
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
            <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              {companies[0].name}
            </div>
          )}

          <div className="ml-auto flex items-center gap-1 md:gap-2">
            {/* Bell — phase 2 notification centre lives here (chunk 5) */}
            <Button
              variant="ghost"
              size="icon"
              className="relative h-10 w-10"
              onClick={() => navigate({ to: "/notifications" })}
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="icon" className="h-10 w-10" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 md:gap-3 rounded-md px-1 md:px-2 py-1.5 hover:bg-accent min-h-[44px]">
                  <Avatar className="h-8 w-8"><AvatarFallback>{initials}</AvatarFallback></Avatar>
                  <div className="text-left leading-tight hidden lg:block">
                    <div className="text-sm font-medium">{profile?.full_name || profile?.email}</div>
                    <Badge variant="secondary" className="h-4 text-[10px] mt-0.5">{roleLabel}</Badge>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{profile?.full_name}</div>
                  <div className="text-xs text-muted-foreground">{profile?.email}</div>
                  <Badge variant="secondary" className="mt-1 text-[10px]">{roleLabel}</Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/change-password" })}>
                  <KeyRound className="h-4 w-4 mr-2" /> Change password
                </DropdownMenuItem>
                {role && SIDEBAR_NAV.find(n => n.to === "/settings" && n.roles.includes(role)) && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                    <Settings className="h-4 w-4 mr-2" /> Settings
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* SA company switch on mobile */}
        {role === "super_admin" && companies.length > 0 && (
          <div className="md:hidden border-b bg-card px-3 py-2">
            <Select
              value={activeCompanyId ?? "__all"}
              onValueChange={(v) => setActiveCompanyId(v === "__all" ? null : v)}
            >
              <SelectTrigger className="w-full h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All companies</SelectItem>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <main className="flex-1 p-3 md:p-6 overflow-auto pb-20 md:pb-6">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t flex items-stretch h-16 safe-bottom">
          {bottomItems.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] min-h-[44px] ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <InstallPrompt />
      </div>
    </div>
  );
}

