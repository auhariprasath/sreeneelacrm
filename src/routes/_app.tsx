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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LayoutDashboard, Users, CalendarDays, ClipboardList, KanbanSquare, BarChart3, Settings, Moon, Sun, LogOut, KeyRound, Building2, Bell, MoreHorizontal, ArrowRightLeft, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { OfflineBanner } from "@/components/offline-banner";
import { useSessionTimeout } from "@/hooks/use-session-timeout";
import { toast } from "sonner";
import { initialsOf } from "@/lib/format";
import { InstallPrompt } from "@/components/install-prompt";
import { WelcomeTour } from "@/components/welcome-tour";
import { GlobalSearch } from "@/components/global-search";
import { NotificationBell } from "@/components/notification-bell";

export const Route = createFileRoute("/_app")({ component: AppLayout });

interface NavItem { to: string; label: string; icon: any; roles: AppRole[] }
interface NavGroup { label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["super_admin","admin","staff"] },
      { to: "/leads", label: "Leads", icon: Users, roles: ["super_admin","admin","staff"] },
      { to: "/bookings", label: "Bookings", icon: ClipboardList, roles: ["super_admin","admin","staff"] },
      { to: "/calendar", label: "Calendar", icon: CalendarDays, roles: ["super_admin","admin","staff"] },
      { to: "/tasks", label: "Task Board", icon: KanbanSquare, roles: ["super_admin","admin","staff"] },
    ],
  },
  {
    label: "Manage",
    items: [
      { to: "/reports", label: "Reports", icon: BarChart3, roles: ["super_admin","admin","staff"] },
      { to: "/transfers", label: "Transfers", icon: ArrowRightLeft, roles: ["super_admin","admin","staff"] },
      { to: "/settings", label: "Settings", icon: Settings, roles: ["super_admin","admin"] },
    ],
  },
];

const BOTTOM_NAV: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, roles: ["super_admin","admin","staff"] },
  { to: "/leads", label: "Leads", icon: Users, roles: ["super_admin","admin","staff"] },
  { to: "/tasks", label: "Tasks", icon: KanbanSquare, roles: ["super_admin","admin","staff"] },
  { to: "/notifications", label: "Alerts", icon: Bell, roles: ["super_admin","admin","staff"] },
  { to: "/more", label: "More", icon: MoreHorizontal, roles: ["super_admin","admin","staff"] },
];

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/leads": "Leads",
  "/bookings": "Bookings",
  "/calendar": "Calendar",
  "/tasks": "Task Board",
  "/reports": "Reports",
  "/transfers": "Transfers",
  "/settings": "Settings",
  "/notifications": "Notifications",
  "/more": "More",
};

function AppLayout() {
  const { loading, user, profile, role, companies, activeCompanyId, setActiveCompanyId, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar:collapsed") === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("sidebar:collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

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

  const groups: NavGroup[] = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((n) => role && n.roles.includes(role)),
  })).filter((g) => g.items.length > 0);

  const bottomItems = BOTTOM_NAV.filter((n) => role && n.roles.includes(role));
  const roleLabel = role === "super_admin" ? "Super Admin" : role === "admin" ? "Admin" : "Staff";
  const initials = initialsOf(profile?.full_name || profile?.email || "U");
  const pageTitle = PAGE_TITLES[pathname] ?? Object.entries(PAGE_TITLES).find(([k]) => pathname.startsWith(k + "/"))?.[1] ?? "";

  return (
    <TooltipProvider delayDuration={120}>
    <div className="flex min-h-screen w-full bg-background flex-col md:flex-row">
      {/* Sidebar — desktop only */}
      <aside
        className={`hidden md:flex shrink-0 bg-sidebar text-sidebar-foreground flex-col transition-[width] duration-200 ease-out ${
          collapsed ? "w-[68px]" : "w-64"
        }`}
      >
        {/* Brand */}
        <div className={`h-16 flex items-center border-b border-sidebar-border ${collapsed ? "justify-center px-2" : "gap-2.5 px-5"}`}>
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 flex items-center justify-center text-sidebar-primary-foreground font-bold shadow-sm">N</div>
          {!collapsed && (
            <div className="leading-tight min-w-0">
              <div className="text-sm font-semibold truncate">Neela Events</div>
              <div className="text-[11px] text-sidebar-foreground/60">CRM</div>
            </div>
          )}
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {groups.map((g) => (
            <div key={g.label}>
              {!collapsed && (
                <div className="px-2 mb-1 text-[10px] font-semibold tracking-wider uppercase text-sidebar-foreground/40">
                  {g.label}
                </div>
              )}
              <div className="space-y-0.5">
                {g.items.map((item) => {
                  const active = pathname === item.to || pathname.startsWith(item.to + "/");
                  const Icon = item.icon;
                  const link = (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`relative flex items-center rounded-md text-sm transition-colors min-h-[40px] ${
                        collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2"
                      } ${
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-sidebar-primary" />
                      )}
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                  return collapsed ? (
                    <Tooltip key={item.to}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ) : link;
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User card / collapse */}
        <div className="border-t border-sidebar-border p-2 space-y-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={`w-full flex items-center rounded-md hover:bg-sidebar-accent/60 transition-colors min-h-[44px] ${
                collapsed ? "justify-center p-1" : "gap-2.5 px-2 py-1.5"
              }`}>
                <Avatar className="h-8 w-8"><AvatarFallback className="bg-sidebar-primary/20 text-sidebar-foreground text-xs">{initials}</AvatarFallback></Avatar>
                {!collapsed && (
                  <div className="text-left leading-tight min-w-0 flex-1">
                    <div className="text-xs font-medium text-sidebar-foreground truncate">{profile?.full_name || profile?.email}</div>
                    <div className="text-[10px] text-sidebar-foreground/55 truncate">{roleLabel}</div>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-sm font-medium">{profile?.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">{profile?.email}</div>
                <Badge variant="secondary" className="mt-1 text-[10px]">{roleLabel}</Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/change-password" })}>
                <KeyRound className="h-4 w-4 mr-2" /> Change password
              </DropdownMenuItem>
              {(role === "super_admin" || role === "admin") && (
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

          <button
            onClick={() => setCollapsed((v) => !v)}
            className={`w-full flex items-center text-[11px] text-sidebar-foreground/55 hover:text-sidebar-foreground rounded-md hover:bg-sidebar-accent/60 transition-colors ${
              collapsed ? "justify-center p-2" : "gap-2 px-3 py-2"
            }`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <OfflineBanner />

        {/* Top header */}
        <header className="h-14 md:h-16 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 flex items-center gap-2 md:gap-3 px-3 md:px-6 sticky top-0 z-30">
          {/* Mobile brand */}
          <div className="md:hidden flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-sm font-bold shadow-sm">N</div>
            <span className="text-sm font-semibold">Neela CRM</span>
          </div>

          {/* Page title — desktop */}
          {pageTitle && (
            <h1 className="hidden md:block text-base font-semibold text-foreground">{pageTitle}</h1>
          )}

          {role === "super_admin" && companies.length > 0 && (
            <div className="hidden md:flex items-center gap-2 ml-2">
              <span className="h-5 w-px bg-border" />
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select
                value={activeCompanyId ?? "__all"}
                onValueChange={(v) => setActiveCompanyId(v === "__all" ? null : v)}
              >
                <SelectTrigger className="w-[200px] h-9 border-0 bg-muted/50 hover:bg-muted focus:ring-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All companies</SelectItem>
                  {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {role !== "super_admin" && companies[0] && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1 ml-2">
              <Building2 className="h-3.5 w-3.5" />
              {companies[0].name}
            </div>
          )}

          <div className="flex-1 min-w-0 max-w-xl mx-auto md:mx-2">
            <GlobalSearch />
          </div>

          <div className="ml-auto flex items-center gap-0.5 md:gap-1">
            <NotificationBell />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10" onClick={toggle} aria-label="Toggle theme">
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle theme</TooltipContent>
            </Tooltip>

            {/* Mobile-only avatar menu (desktop has sidebar user card) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="md:hidden flex items-center rounded-md p-1 hover:bg-accent min-h-[44px] min-w-[44px] justify-center">
                  <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{initials}</AvatarFallback></Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{profile?.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{profile?.email}</div>
                  <Badge variant="secondary" className="mt-1 text-[10px]">{roleLabel}</Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/change-password" })}>
                  <KeyRound className="h-4 w-4 mr-2" /> Change password
                </DropdownMenuItem>
                {(role === "super_admin" || role === "admin") && (
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

        <main className="flex-1 p-3 md:p-6 overflow-auto pb-24 md:pb-6">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-t flex items-stretch h-16 safe-bottom px-1">
          {bottomItems.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] min-h-[44px] relative"
              >
                <div className={`flex items-center justify-center h-7 w-12 rounded-full transition-colors ${
                  active ? "bg-primary/15 text-primary" : "text-muted-foreground"
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={active ? "text-primary font-medium" : "text-muted-foreground"}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <InstallPrompt />
        <WelcomeTour />
      </div>
    </div>
    </TooltipProvider>
  );
}
