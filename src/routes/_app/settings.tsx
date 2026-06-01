import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Users, Filter, CalendarRange, Clock, Tags, Plus, Percent, Bell, CalendarCheck,
  FileText, XCircle, MessageSquare, Briefcase, Lock,
} from "lucide-react";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

const SECTIONS = [
  { id: "company", label: "Company details", icon: Building2, superOnly: false },
  { id: "staff", label: "Staff & roles", icon: Users, superOnly: false },
  { id: "routing", label: "Routing rules", icon: Filter, superOnly: true },
  { id: "event-types", label: "Event types", icon: Tags, superOnly: true },
  { id: "sessions", label: "Sessions & slots", icon: CalendarRange, superOnly: true },
  { id: "services", label: "Services & pricing", icon: Briefcase, superOnly: true },
  { id: "addons", label: "Add-ons", icon: Plus, superOnly: true },
  { id: "discounts", label: "Discount rules", icon: Percent, superOnly: true },
  { id: "reminders", label: "Reminder timing", icon: Bell, superOnly: true },
  { id: "peak", label: "Peak season dates", icon: CalendarCheck, superOnly: true },
  { id: "cancellation", label: "Cancellation policy", icon: FileText, superOnly: true },
  { id: "drop", label: "Drop reasons", icon: XCircle, superOnly: true },
  { id: "wa", label: "WhatsApp templates", icon: MessageSquare, superOnly: true },
  { id: "vendors", label: "Vendor list", icon: Users, superOnly: true },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function EmptyTable({ desc }: { desc: string }) {
  return <div className="text-sm text-muted-foreground border border-dashed rounded-md p-8 text-center">{desc}</div>;
}

function SettingsPage() {
  const { role, companies, loading } = useAuth();
  const [section, setSection] = useState<SectionId>("company");
  const [companyTab, setCompanyTab] = useState(companies[0]?.id ?? "");

  if (loading) return null;
  if (!role || (role !== "super_admin" && role !== "admin")) return <Navigate to="/dashboard" replace />;

  const visible = SECTIONS.filter((s) => role === "super_admin" || !s.superOnly);
  const currentCompany = companies.find((c) => c.id === companyTab) ?? companies[0];

  const renderSection = () => {
    switch (section) {
      case "company":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Company details</CardTitle>
              <CardDescription>Business information per company.</CardDescription>
            </CardHeader>
            <CardContent>
              {role === "super_admin" && companies.length > 0 && (
                <Tabs value={companyTab} onValueChange={setCompanyTab} className="mb-6">
                  <TabsList>{companies.map((c) => <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>)}</TabsList>
                </Tabs>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  ["Company name", currentCompany?.name],
                  ["GSTIN", ""], ["WhatsApp number", ""], ["Email", ""],
                  ["Bank account", ""], ["IFSC", ""], ["UPI ID", ""],
                  ["Google review link", ""],
                ].map(([label, val]) => (
                  <div key={label as string} className="space-y-1.5">
                    <Label>{label as string}</Label>
                    <Input defaultValue={val as string} placeholder={`Enter ${(label as string).toLowerCase()}`} />
                  </div>
                ))}
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Address</Label>
                  <Textarea rows={3} placeholder="Full venue address" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Logo</Label>
                  <Input type="file" accept="image/*" />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline">Cancel</Button>
                <Button>Save changes</Button>
              </div>
            </CardContent>
          </Card>
        );
      case "staff":
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Staff & roles</CardTitle>
                <CardDescription>Manage users, roles, and auto-approve transfers.</CardDescription>
              </div>
              <Button><Plus className="h-4 w-4 mr-1" />Add staff</Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <div className="grid grid-cols-12 px-4 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/40">
                  <div className="col-span-4">Name</div>
                  <div className="col-span-2">Role</div>
                  <div className="col-span-3">Company</div>
                  <div className="col-span-2">Auto-approve</div>
                  <div className="col-span-1 text-right">Active</div>
                </div>
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Staff list loads from the database (placeholder for Phase 1).
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case "discounts":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Discount rules</CardTitle>
              <CardDescription>Maximum discount each role can apply.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                ["Staff max", "5"], ["Admin max", "15"], ["Super Admin max", "Unlimited"],
              ].map(([label, val]) => (
                <div key={label as string} className="space-y-1.5">
                  <Label>{label as string}</Label>
                  <Input defaultValue={val as string} suffix="%" />
                </div>
              ))}
            </CardContent>
          </Card>
        );
      case "reminders":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Reminder timing</CardTitle>
              <CardDescription>Default cadences for follow-ups and reminders.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ["Default follow-up time (hours)", "24"],
                ["Max follow-up attempts", "5"],
                ["Balance reminder (days before)", "7"],
                ["Feedback delay (days after event)", "1"],
                ["Re-engagement delay (days)", "30"],
              ].map(([label, val]) => (
                <div key={label as string} className="space-y-1.5">
                  <Label>{label as string}</Label>
                  <Input defaultValue={val as string} />
                </div>
              ))}
            </CardContent>
          </Card>
        );
      case "cancellation":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Cancellation policy</CardTitle>
              <CardDescription>Refund tiers and policy shown to customers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Policy text</Label>
                <Textarea rows={5} placeholder="Describe the full cancellation policy…" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  ["More than 30 days before", "80"],
                  ["15 – 30 days before", "50"],
                  ["Less than 15 days before", "0"],
                ].map(([label, val]) => (
                  <div key={label as string} className="space-y-1.5">
                    <Label>{label as string}</Label>
                    <Input defaultValue={val as string} suffix="%" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      default: {
        const desc: Record<string, string> = {
          routing: "Keyword rules per company route incoming leads automatically.",
          "event-types": "Reusable event categories (Wedding, Reception, Birthday…).",
          sessions: "Bookable time slots (Morning, Evening, Full day…).",
          services: "Services and base prices offered by each venue.",
          addons: "Optional extras and their prices.",
          peak: "Date ranges where peak-season pricing applies.",
          drop: "Reasons captured when a lead is dropped.",
          wa: "Pre-written WhatsApp message templates.",
          vendors: "External vendor directory (catering, decor, photography…).",
        };
        const titleMap = Object.fromEntries(SECTIONS.map((s) => [s.id, s.label]));
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{titleMap[section]}</CardTitle>
                <CardDescription>{desc[section]}</CardDescription>
              </div>
              <Button><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </CardHeader>
            <CardContent><EmptyTable desc="No entries yet." /></CardContent>
          </Card>
        );
      }
    }
  };

  return (
    <div className="flex gap-6 max-w-7xl">
      <aside className="w-60 shrink-0">
        <h1 className="text-2xl font-semibold mb-1">Settings</h1>
        <p className="text-xs text-muted-foreground mb-4">{role === "super_admin" ? "Master settings" : "Company settings"}</p>
        <nav className="space-y-1">
          {visible.map((s) => {
            const Icon = s.icon;
            const active = s.id === section;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`w-full flex items-center gap-2 text-left rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/60 text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {s.label}
              </button>
            );
          })}
          {role !== "super_admin" && (
            <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground border rounded-md p-3">
              <Lock className="h-3.5 w-3.5 mt-0.5" />
              Some master settings are restricted to Super Admin.
            </div>
          )}
        </nav>
      </aside>
      <div className="flex-1 min-w-0">{renderSection()}</div>
    </div>
  );
}
