import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, ClipboardList, CalendarClock, AlertCircle, IndianRupee, ListTodo, Inbox } from "lucide-react";
import { DashboardSkeleton } from "@/components/skeleton-dashboard";
import { formatINR } from "@/lib/format";


export const Route = createFileRoute("/_app/dashboard")({ component: DashboardPage });

function StatCard({ label, value, icon: Icon, hint }: { label: string; value: string | number; icon: any; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold mt-1">{value}</div>
            {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
          </div>
          <div className="h-10 w-10 rounded-lg bg-accent text-accent-foreground flex items-center justify-center">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyList({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 text-muted-foreground">
      <Icon className="h-8 w-8 mb-2 opacity-50" />
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="text-xs mt-1">{desc}</div>
    </div>
  );
}

function DashboardPage() {
  const { role, companies, profile, loading } = useAuth();
  if (loading) return <DashboardSkeleton />;
  const greeting = `Welcome, ${profile?.full_name || "there"}`;


  if (role === "super_admin") {
    return (
      <div className="space-y-6 max-w-7xl">
        <div>
          <h1 className="text-2xl font-semibold">{greeting}</h1>
          <p className="text-sm text-muted-foreground">Overview across all 4 companies</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {companies.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{c.name}</CardTitle>
                <CardDescription className="capitalize">{c.type} venue</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">New leads</span><span className="font-medium">0</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Active leads</span><span className="font-medium">0</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Bookings</span><span className="font-medium">0</span></div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total leads" value={0} icon={Users} />
          <StatCard label="Total bookings" value={0} icon={ClipboardList} />
          <StatCard label="Pending payments" value={formatINR(0)} icon={IndianRupee} />
          <StatCard label="Upcoming events" value={0} icon={CalendarClock} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Need action</CardTitle></CardHeader>
            <CardContent><EmptyList icon={Inbox} title="Nothing needs your attention" desc="Items requiring action will appear here." /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Conflict alerts</CardTitle></CardHeader>
            <CardContent><EmptyList icon={AlertCircle} title="No conflicts detected" desc="Booking and slot conflicts will appear here." /></CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // admin / staff
  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold">{greeting}</h1>
        <p className="text-sm text-muted-foreground">
          {companies[0]?.name ?? "Your company"} overview
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="New leads today" value={0} icon={Users} />
        <StatCard label="Active leads" value={0} icon={Users} />
        <StatCard label="Bookings this month" value={0} icon={ClipboardList} />
        <StatCard label="Pending follow-ups" value={0} icon={ListTodo} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">My leads</CardTitle></CardHeader>
        <CardContent><EmptyList icon={Users} title="No leads yet" desc="Assigned leads will appear here." /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Upcoming tasks</CardTitle></CardHeader>
        <CardContent><EmptyList icon={ListTodo} title="No tasks scheduled" desc="Follow-ups and reminders will appear here." /></CardContent>
      </Card>
    </div>
  );
}
