import { createFileRoute, Outlet, Link, useNavigate, useRouterState, Navigate } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  LayoutDashboard, Users, CalendarDays, ClipboardList, KanbanSquare, BarChart3, Settings, Moon, Sun, LogOut, KeyRound, Building2, Bell, MoreHorizontal, ArrowRightLeft, FileText, Menu, Globe,
  PhoneCall, Megaphone, MapPin, UserX, Star, MessageSquare,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAppLogo } from "@/lib/use-app-logo";
import { OfflineBanner } from "@/components/offline-banner";
import { getSidebarPrefs, ALL_NAV_ITEMS } from "@/components/settings/sidebar-order-section";
import { useSessionTimeout } from "@/hooks/use-session-timeout";
import { toast } from "sonner";
import { initialsOf } from "@/lib/format";
import { InstallPrompt } from "@/components/install-prompt";
import { WelcomeTour } from "@/components/welcome-tour";
import { GlobalSearch } from "@/components/global-search";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeColorPicker } from "@/components/theme-color-picker";


export const Route = createFileRoute("/_app")({ component: AppLayout });

interface NavItem { to: string; label: string; icon: any; roles: AppRole[] }

const SIDEBAR_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["super_admin","admin","staff"] },
  { to: "/leads", label: "Leads", icon: Users, roles: ["super_admin","admin","staff"] },
  { to: "/bookings", label: "Bookings", icon: ClipboardList, roles: ["super_admin","admin","staff"] },
  { to: "/quotations", label: "Quotations", icon: FileText, roles: ["super_admin","admin","staff"] },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, roles: ["super_admin","admin","staff"] },
  { to: "/follow-ups", label: "Follow-ups", icon: PhoneCall, roles: ["super_admin","admin","staff"] },
  { to: "/tasks", label: "Task Board", icon: KanbanSquare, roles: ["super_admin","admin","staff"] },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone, roles: ["super_admin","admin"] },
  { to: "/venue-meetings", label: "Venue Meetings", icon: MapPin, roles: ["super_admin","admin","staff"] },
  { to: "/customers", label: "Customers", icon: Star, roles: ["super_admin","admin","staff"] },
  { to: "/not-interested", label: "Not Interested", icon: UserX, roles: ["super_admin","admin"] },
  { to: "/stale-leads", label: "Stale Leads", icon: MessageSquare, roles: ["super_admin","admin"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["super_admin","admin","staff"] },
  { to: "/transfers", label: "Transfers", icon: ArrowRightLeft, roles: ["super_admin","admin","staff"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["super_admin","admin"] },
];

// Mobile bottom nav: Dashboard | Leads | Tasks | Notifications | More
const BOTTOM_NAV: Omit<NavItem, "to"> & { to: string | null }[] = [] as any;
const BOTTOM_TABS: { key: string; to: string | null; label: string; icon: any; roles: AppRole[] }[] = [
  { key: "dashboard", to: "/dashboard", label: "Home", icon: LayoutDashboard, roles: ["super_admin","admin","staff"] },
  { key: "leads", to: "/leads", label: "Leads", icon: Users, roles: ["super_admin","admin","staff"] },
  { key: "tasks", to: "/tasks", label: "Tasks", icon: KanbanSquare, roles: ["super_admin","admin","staff"] },
  { key: "notifications", to: "/notifications", label: "Alerts", icon: Bell, roles: ["super_admin","admin","staff"] },
  { key: "more", to: null, label: "More", icon: MoreHorizontal, roles: ["super_admin","admin","staff"] },
];

// Items shown in the "More" sheet on mobile
const MORE_SHEET_NAV: NavItem[] = [
  { to: "/bookings", label: "Bookings", icon: ClipboardList, roles: ["super_admin","admin","staff"] },
  { to: "/quotations", label: "Quotations", icon: FileText, roles: ["super_admin","admin","staff"] },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, roles: ["super_admin","admin","staff"] },
  { to: "/follow-ups", label: "Follow-ups", icon: PhoneCall, roles: ["super_admin","admin","staff"] },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone, roles: ["super_admin","admin"] },
  { to: "/venue-meetings", label: "Venue Meetings", icon: MapPin, roles: ["super_admin","admin","staff"] },
  { to: "/customers", label: "Customers", icon: Star, roles: ["super_admin","admin","staff"] },
  { to: "/not-interested", label: "Not Interested", icon: UserX, roles: ["super_admin","admin"] },
  { to: "/stale-leads", label: "Stale Leads", icon: MessageSquare, roles: ["super_admin","admin"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["super_admin","admin","staff"] },
  { to: "/transfers", label: "Transfers", icon: ArrowRightLeft, roles: ["super_admin","admin","staff"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["super_admin","admin"] },
];

function AppLayout() {
  const { loading, user, profile, role, companies, activeCompanyId, setActiveCompanyId, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const appLogo = useAppLogo();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleCompanyChange = (v: string) => {
    const nextId = v === "__all" ? null : v;
    setActiveCompanyId(nextId);
    // Always navigate so the new company context loads cleanly.
    if (nextId) {
      navigate({ to: "/company-dashboard/$companyId", params: { companyId: nextId } });
    } else {
      navigate({ to: "/dashboard" });
    }
  };

  const [tabletNavOpen, setTabletNavOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Close overlays on route change
  useEffect(() => {
    setTabletNavOpen(false);
    setMoreOpen(false);
  }, [pathname]);

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

  const prefs = getSidebarPrefs();
  const sidebarItems = prefs.order
    .filter((key) => !prefs.hidden.includes(key as any))
    .map((key) => SIDEBAR_NAV.find((n) => n.to === `/${key}`))
    .filter((n): n is NavItem => !!n && !!role && n.roles.includes(role));
  const moreItems = MORE_SHEET_NAV.filter((n) => role && n.roles.includes(role));
  const bottomItems = BOTTOM_TABS.filter((n) => role && n.roles.includes(role));
  const roleLabel = role === "super_admin" ? "Super Admin" : role === "admin" ? "Admin" : "Staff";
  const initials = initialsOf(profile?.full_name || profile?.email || "U");

  const isActive = (to: string) => {
    const dashboardCompanyId = role === "super_admin" && to === "/dashboard" ? activeCompanyId : null;
    return dashboardCompanyId
      ? pathname === `/company-dashboard/${dashboardCompanyId}`
      : pathname === to || pathname.startsWith(to + "/");
  };

  const renderNavLink = (item: NavItem, opts: { collapsed: boolean }) => {
    const dashboardCompanyId = role === "super_admin" && item.to === "/dashboard" ? activeCompanyId : null;
    const active = isActive(item.to);
    const Icon = item.icon;
    return (
      <Link
        key={item.to}
        to={dashboardCompanyId ? "/company-dashboard/$companyId" : item.to}
        params={dashboardCompanyId ? { companyId: dashboardCompanyId } : undefined}
        title={item.label}
        className={`flex items-center gap-3 rounded-md py-2 text-sm transition-colors ${
          opts.collapsed ? "justify-center px-2" : "justify-start px-3"
        } ${
          active
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!opts.collapsed && <span>{item.label}</span>}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen w-full bg-background flex-col md:flex-row">
      {/* Persistent sidebar — visible at md+ (768px+).
          md (768-1023): icon rail 56px with hamburger.
          lg+ (1024+):   full sidebar 220px, no hamburger. */}
      <aside
        className="hidden md:flex shrink-0 bg-sidebar text-sidebar-foreground flex-col
                   w-14 lg:w-[220px] transition-[width] duration-200 sticky top-0 h-screen"
        title="Navigation"
      >
        <div className="h-16 flex items-center gap-2 px-2 lg:px-4 border-b border-sidebar-border">
          {/* Hamburger — visible only on tablet rail (md to lg-1) */}
          <button
            type="button"
            onClick={() => setTabletNavOpen(true)}
            className="lg:hidden h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-sidebar-accent"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:flex items-center gap-2">
            <div className="h-8 w-8 shrink-0 rounded-md bg-sidebar-primary overflow-hidden flex items-center justify-center">
              <img src={appLogo} alt="Logo" className="h-full w-full object-contain" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Neela Events</div>
              <div className="text-[11px] text-sidebar-foreground/60">CRM</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-2 lg:p-3 space-y-1 overflow-y-auto">
          {/* Render two variants and toggle via responsive visibility so labels appear only at lg+ */}
          <div className="lg:hidden space-y-1">
            {sidebarItems.map((item) => renderNavLink(item, { collapsed: true }))}
          </div>
          <div className="hidden lg:block space-y-1">
            {sidebarItems.map((item) => renderNavLink(item, { collapsed: false }))}
          </div>
        </nav>
        <div className="p-3 text-[11px] text-sidebar-foreground/50 border-t border-sidebar-border hidden lg:block">
          v0.4 · Phase 4
        </div>
      </aside>

      {/* Tablet overlay sidebar (md to lg-1): triggered by rail hamburger */}
      <Sheet open={tabletNavOpen} onOpenChange={setTabletNavOpen}>
        <SheetContent side="left" className="w-[260px] p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
          <SheetHeader className="h-16 px-4 border-b border-sidebar-border flex flex-row items-center gap-2 space-y-0">
            <div className="h-8 w-8 rounded-md bg-sidebar-primary overflow-hidden flex items-center justify-center">
              <img src={appLogo} alt="Logo" className="h-full w-full object-contain" />
            </div>
            <SheetTitle className="text-sm font-semibold text-sidebar-foreground">Neela Events</SheetTitle>
          </SheetHeader>
          <nav className="p-3 space-y-1 overflow-y-auto">
            {sidebarItems.map((item) => renderNavLink(item, { collapsed: false }))}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Mobile "More" bottom sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 mt-4 pb-6">
            {moreItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-md border px-3 py-3 text-sm min-h-[48px] ${
                    active ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <OfflineBanner />

        {/* Top header */}
        <header className="h-14 lg:h-16 border-b bg-card flex items-center gap-2 lg:gap-3 px-3 lg:px-6 sticky top-0 z-30">
          {/* Mobile (below md): hamburger + brand */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="md:hidden h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-accent"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="md:hidden flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary overflow-hidden flex items-center justify-center">
              <img src={appLogo} alt="Logo" className="h-full w-full object-contain" />
            </div>
            <span className="text-sm font-semibold">Neela CRM</span>
          </div>

          {role === "super_admin" && companies.length > 0 && (() => {
            const selected = companies.find((c) => c.id === activeCompanyId) || null;
            return (
              <div className="hidden md:flex items-center gap-2">
                <Select
                  value={activeCompanyId ?? "__all"}
                  onValueChange={handleCompanyChange}
                >
                  <SelectTrigger className="w-[180px] lg:w-[220px] h-9">
                    <span className="flex items-center gap-2 min-w-0">
                      {selected ? (
                        <span
                          className="h-3 w-3 rounded-full shrink-0 ring-1 ring-border"
                          style={{ background: selected.brand_color || "#6366f1" }}
                        />
                      ) : (
                        <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="truncate text-sm">{selected ? selected.name : "All companies"}</span>
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">
                      <span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> All companies</span>
                    </SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.brand_color || "#6366f1" }} />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })()}
          {role !== "super_admin" && companies[0] && (
            <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span className="truncate max-w-[180px]">{companies[0].name}</span>
            </div>
          )}

          <GlobalSearch />

          <div className="ml-auto flex items-center gap-1 lg:gap-2">
            <NotificationBell />
            <ThemeColorPicker />

            <Button variant="ghost" size="icon" className="h-10 w-10" onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 lg:gap-3 rounded-md px-1 lg:px-2 py-1.5 hover:bg-accent min-h-[44px]">
                  <Avatar className="h-8 w-8"><AvatarFallback>{initials}</AvatarFallback></Avatar>
                  <div className="text-left leading-tight hidden xl:block">
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

        {role === "super_admin" && companies.length > 0 && (() => {
          const selected = companies.find((c) => c.id === activeCompanyId) || null;
          return (
            <div className="md:hidden border-b bg-card px-3 py-2">
              <Select
                value={activeCompanyId ?? "__all"}
                onValueChange={handleCompanyChange}
              >
                <SelectTrigger className="w-full h-10">
                  <span className="flex items-center gap-2 min-w-0">
                    {selected ? (
                      <span className="h-3 w-3 rounded-full shrink-0 ring-1 ring-border"
                        style={{ background: selected.brand_color || "#6366f1" }} />
                    ) : (
                      <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate text-sm">{selected ? selected.name : "All companies"}</span>
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">
                    <span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> All companies</span>
                  </SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.brand_color || "#6366f1" }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })()}

        <main className="flex-1 p-3 lg:p-6 overflow-auto pb-20 md:pb-6">
          <Outlet />
        </main>

        {/* Bottom nav — phones only (sidebar takes over at md+) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t flex items-stretch h-16 safe-bottom">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            if (item.to === null) {
              // "More" tab → opens bottom sheet
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setMoreOpen(true)}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] min-h-[44px] ${
                    moreOpen ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            }
            const dashboardCompanyId = role === "super_admin" && item.to === "/dashboard" ? activeCompanyId : null;
            const active = isActive(item.to);
            return (
              <Link
                key={item.key}
                to={dashboardCompanyId ? "/company-dashboard/$companyId" : item.to}
                params={dashboardCompanyId ? { companyId: dashboardCompanyId } : undefined}
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
        <WelcomeTour />
      </div>
    </div>
  );
}
