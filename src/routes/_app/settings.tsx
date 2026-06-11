import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, Users, CalendarCheck, Plus, Percent, MessageSquare, CreditCard,
  ListChecks, XCircle, Lock, Clock, Globe, ImageIcon, UserPlus, Trash2,
} from "lucide-react";
import { StaffSection } from "@/components/settings/staff-section";
import { useServerFn } from "@tanstack/react-start";
import { createStaff, listCompanyStaff, deleteStaff } from "@/lib/api/staff.functions";
import { CompanyFieldsSection, type CompanyField } from "@/components/settings/company-fields-section";
import { PaymentCredentialsSection } from "@/components/settings/payment-credentials-section";
import { TaskTemplatesSection } from "@/components/settings/task-templates-section";
import { WhatsappTemplatesSection } from "@/components/settings/whatsapp-templates-section";
import { VendorsSection } from "@/components/settings/vendors-section";
import { CompaniesSection } from "@/components/settings/companies-section";
import { ReminderTimingSection } from "@/components/settings/reminder-timing-section";
import { IntegrationsSection } from "@/components/settings/integrations-section";
import { SidebarOrderSection } from "@/components/settings/sidebar-order-section";
import { LogoSection } from "@/components/settings/logo-section";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

const SECTIONS = [
  { id: "companies", label: "Companies", icon: Building2, superOnly: true },
  { id: "staff", label: "Staff and roles", icon: Users, superOnly: false },
  { id: "wa", label: "WhatsApp templates", icon: MessageSquare, superOnly: false },
  { id: "reminders", label: "Reminder timing", icon: Clock, superOnly: false },
  { id: "peak", label: "Peak season dates", icon: CalendarCheck, superOnly: false },
  { id: "vendors", label: "Vendor list", icon: Users, superOnly: false },
  { id: "task-templates", label: "Task templates", icon: ListChecks, superOnly: false },
  { id: "payment", label: "Payment gateway", icon: CreditCard, superOnly: false },
  { id: "discounts", label: "Discount rules", icon: Percent, superOnly: false },
  { id: "integrations", label: "Integrations", icon: Globe, superOnly: false },
  { id: "sidebar-order", label: "Sidebar Order", icon: ListChecks, superOnly: false },
  { id: "logo", label: "Logo", icon: ImageIcon, superOnly: false },
  { id: "add-employees", label: "Add Employees", icon: UserPlus, superOnly: true },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function PeakSection({ companyId }: { companyId: string | undefined }) {
  const [ranges, setRanges] = useState<{ start: string; end: string; label?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    supabase.from("companies").select("peak_season_dates").eq("id", companyId).maybeSingle().then(({ data }) => {
      setRanges(Array.isArray((data as any)?.peak_season_dates) ? (data as any).peak_season_dates : []);
      setLoading(false);
    });
  }, [companyId]);

  if (!companyId) return <div className="text-sm text-muted-foreground p-6">Select a company first.</div>;
  if (loading) return <div className="text-sm text-muted-foreground p-6">Loading…</div>;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("companies").update({ peak_season_dates: ranges as any }).eq("id", companyId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saved ✓");
  };

  return (
    <div className="space-y-3">
      {ranges.map((r, i) => (
        <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
          <div className="space-y-1.5">
            <Label>Label</Label>
            <Input value={r.label ?? ""} onChange={(e) => setRanges(ranges.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="e.g. Diwali" />
          </div>
          <div className="space-y-1.5">
            <Label>Start</Label>
            <Input type="date" value={r.start} onChange={(e) => setRanges(ranges.map((x, j) => j === i ? { ...x, start: e.target.value } : x))} />
          </div>
          <div className="space-y-1.5">
            <Label>End</Label>
            <Input type="date" value={r.end} onChange={(e) => setRanges(ranges.map((x, j) => j === i ? { ...x, end: e.target.value } : x))} />
          </div>
          <Button variant="ghost" size="icon" onClick={() => setRanges(ranges.filter((_, j) => j !== i))} aria-label="Remove"><XCircle className="h-4 w-4" /></Button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setRanges([...ranges, { start: "", end: "", label: "" }])}><Plus className="h-4 w-4 mr-1" />Add range</Button>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}

function SettingsPage() {
  const { role, companies, loading } = useAuth();
  const [section, setSection] = useState<SectionId>("companies");
  const [companyTab, setCompanyTab] = useState(companies[0]?.id ?? "");

  useEffect(() => {
    if (!companyTab && companies[0]) setCompanyTab(companies[0].id);
  }, [companies, companyTab]);

  // Non-super admins shouldn't land on "companies"
  useEffect(() => {
    if (role && role !== "super_admin" && section === "companies") {
      setSection("staff");
    }
  }, [role, section]);

  if (loading) return null;
  if (!role || (role !== "super_admin" && role !== "admin")) return <Navigate to="/dashboard" replace />;

  const visible = SECTIONS.filter((s) => role === "super_admin" || !s.superOnly);

  const activeCompanyId = role === "super_admin" ? companyTab : companies[0]?.id;

  const CompanyPicker = () =>
    role === "super_admin" && companies.length > 0 ? (
      <Tabs value={companyTab} onValueChange={setCompanyTab} className="mb-6">
        <TabsList className="flex-wrap">{companies.map((c) => <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>)}</TabsList>
      </Tabs>
    ) : null;

  const renderSection = () => {
    switch (section) {
      case "companies":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Companies</CardTitle>
              <CardDescription>Pick a company to open its full settings — company details, venue and media, services and pricing, sessions, confirmation message and discount rules.</CardDescription>
            </CardHeader>
            <CardContent>
              <CompaniesSection />
            </CardContent>
          </Card>
        );
      case "staff":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Staff and roles</CardTitle>
              <CardDescription>Manage users, deactivate accounts, control phone masking and auto-approve transfers.</CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyPicker />
              <StaffSection companyId={activeCompanyId} />
            </CardContent>
          </Card>
        );
      case "wa":
        return (
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp templates</CardTitle>
              <CardDescription>All 30 templates that the system can send. Toggle auto-send per template or preview a sample before sending. Use square-bracket placeholders.</CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyPicker />
              {activeCompanyId ? (
                <WhatsappTemplatesSection companyId={activeCompanyId} />
              ) : (
                <div className="text-sm text-muted-foreground">Pick a company to manage templates.</div>
              )}
            </CardContent>
          </Card>
        );
      case "reminders":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Reminder timing</CardTitle>
              <CardDescription>Stale lead alert thresholds per stage. Admins are notified when a lead sits in a stage too long; Super Admin is also notified on No-reply escalations.</CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyPicker />
              <ReminderTimingSection companyId={activeCompanyId} />
            </CardContent>
          </Card>
        );
      case "peak":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Peak season dates</CardTitle>
              <CardDescription>Date ranges where peak-season pricing applies.</CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyPicker />
              <PeakSection companyId={activeCompanyId} />
            </CardContent>
          </Card>
        );
      case "vendors":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Vendor list</CardTitle>
              <CardDescription>Caterers, decorators, photographers, DJs and other external service providers.</CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyPicker />
              <VendorsSection companyId={activeCompanyId} />
            </CardContent>
          </Card>
        );
      case "task-templates":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Task templates</CardTitle>
              <CardDescription>Auto-generate a task board for every confirmed booking. Set timing, assignee, and priority.</CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyPicker />
              <TaskTemplatesSection companyId={activeCompanyId} />
            </CardContent>
          </Card>
        );
      case "payment": {
        const fields: CompanyField[] = [
          { key: "payment_method", label: "Payment method", placeholder: "manual or razorpay", description: "Set to 'razorpay' to enable auto-detection via Razorpay payment links.", fullWidth: true },
          { key: "razorpay_test_mode", label: "Razorpay test mode", type: "switch", description: "Off = live keys." },
          { key: "vendor_status_reminder_hours", label: "Vendor status reminder (hours before event)", type: "number", suffix: "hrs", description: "Auto-WA to vendors who haven't updated status N hours before event." },
        ];
        return (
          <Card>
            <CardHeader>
              <CardTitle>Payment gateway</CardTitle>
              <CardDescription>Manual is always available. Razorpay enables auto-detected payments via webhook.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <CompanyPicker />
              <CompanyFieldsSection companyId={activeCompanyId} fields={fields} />
              <PaymentCredentialsSection companyId={activeCompanyId} />
            </CardContent>
          </Card>
        );
      }
      case "discounts": {
        const fields: CompanyField[] = [
          { key: "staff_max_discount_percent", label: "Staff max %", type: "number", suffix: "%", description: "Default 5. Staff cannot exceed without approval." },
          { key: "admin_max_discount_percent", label: "Admin max %", type: "number", suffix: "%", description: "Default 15." },
          { key: "gst_percent", label: "GST %", type: "number", suffix: "%", description: "Default GST applied to quotations." },
          { key: "require_discount_reason", label: "Require reason for discount", type: "switch", description: "Default ON. Staff must enter a reason when applying any discount." },
        ];
        return (
          <Card>
            <CardHeader>
              <CardTitle>Discount rules</CardTitle>
              <CardDescription>Caps and policy. Super admin discount is unlimited (not editable). Per-staff quotation-send permissions live inside each company.</CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyPicker />
              <CompanyFieldsSection companyId={activeCompanyId} fields={fields} />
            </CardContent>
          </Card>
        );
      }
      case "integrations": {
        return (
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>Connect third-party services like IndiaMART, JustDial, payment gateways, and more. Each company manages its own integrations.</CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyPicker />
              <IntegrationsSection companyId={activeCompanyId} />
            </CardContent>
          </Card>
        );
      }
      case "sidebar-order": {
        return (
          <Card>
            <CardHeader>
              <CardTitle>Sidebar Order</CardTitle>
              <CardDescription>Drag to reorder sidebar items. Hide ones you don't use. Changes are saved per browser.</CardDescription>
            </CardHeader>
            <CardContent>
              <SidebarOrderSection />
            </CardContent>
          </Card>
        );
      }
      case "logo": {
        return (
          <Card>
            <CardHeader>
              <CardTitle>Logo</CardTitle>
              <CardDescription>Upload a custom logo shown across the entire app. Applies globally — not per company. Defaults to icon-192.png if none uploaded.</CardDescription>
            </CardHeader>
            <CardContent>
              <LogoSection />
            </CardContent>
          </Card>
        );
      }
      case "add-employees": {
        return (
          <Card>
            <CardHeader>
              <CardTitle>Add Employees</CardTitle>
              <CardDescription>Create employee login accounts. New accounts must change their password on first login.</CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyPicker />
              <AddEmployeesSection companyId={activeCompanyId} />
            </CardContent>
          </Card>
        );
      }
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 max-w-7xl">
      <aside className="md:w-60 md:shrink-0">
        <h1 className="text-2xl font-semibold mb-1">Settings</h1>
        <p className="text-xs text-muted-foreground mb-4">{role === "super_admin" ? "Master settings" : "Company settings"}</p>
        <nav className="space-y-1 grid grid-cols-2 md:grid-cols-1 gap-1">
          {visible.map((s) => {
            const Icon = s.icon;
            const active = s.id === section;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`w-full flex items-center gap-2 text-left rounded-md px-3 py-2 text-sm transition-colors min-h-[44px] ${
                  active ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/60 text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {s.label}
              </button>
            );
          })}
        </nav>
        {role !== "super_admin" && (
          <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground border rounded-md p-3">
            <Lock className="h-3.5 w-3.5 mt-0.5" />
            Companies management is restricted to Super Admin.
          </div>
        )}
      </aside>
      <div className="flex-1 min-w-0">{renderSection()}</div>
    </div>
  );
}

interface EmployeeRow { id: string; full_name: string; email: string | null; is_active: boolean; role: string }

function AddEmployeesSection({ companyId }: { companyId: string | undefined }) {
  const create = useServerFn(createStaff);
  const list = useServerFn(listCompanyStaff);
  const del = useServerFn(deleteStaff);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const loadList = async () => {
    if (!companyId) return;
    setLoadingList(true);
    try {
      const data = await list({ data: { company_id: companyId } });
      setEmployees((data as EmployeeRow[]).filter((e) => e.role === "staff"));
    } catch { /* ignore */ } finally { setLoadingList(false); }
  };

  useEffect(() => { loadList(); /* eslint-disable-next-line */ }, [companyId]);

  const submit = async () => {
    if (!companyId) { toast.error("Select a company first"); return; }
    if (!fullName.trim() || !email.trim() || password.length < 8) {
      toast.error("Name, email, and a password (8+ characters) are required");
      return;
    }
    setBusy(true);
    try {
      await create({ data: { company_id: companyId, full_name: fullName.trim(), email: email.trim(), password, phone: "", role: "staff" } });
      toast.success(`Employee account created for ${email.trim()}`);
      setFullName(""); setEmail(""); setPassword("");
      loadList();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create account");
    } finally { setBusy(false); }
  };

  const handleDelete = async (emp: EmployeeRow) => {
    if (!window.confirm(`Delete ${emp.full_name}? This will deactivate their account and sign them out immediately.`)) return;
    setDeletingId(emp.id);
    try {
      await del({ data: { user_id: emp.id } });
      toast.success(`${emp.full_name} deleted`);
      loadList();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
    } finally { setDeletingId(null); }
  };

  if (!companyId) return <div className="text-sm text-muted-foreground">Select a company above first.</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 space-y-4">
        <p className="text-sm font-medium">Create new employee account</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Employee name" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="employee@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Password <span className="text-muted-foreground text-xs">(min 8 chars)</span></Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Temporary password" />
          </div>
        </div>
        <Button onClick={submit} disabled={busy} size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> {busy ? "Creating…" : "Create employee"}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Existing employees</p>
        {loadingList ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : employees.length === 0 ? (
          <div className="text-sm text-muted-foreground">No employees yet.</div>
        ) : (
          <div className="rounded-lg border divide-y text-sm">
            {employees.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{e.full_name}</div>
                  <div className="text-xs text-muted-foreground">{e.email ?? "—"}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${e.is_active ? "bg-success/10 text-success border-success/30" : "bg-muted text-muted-foreground"}`}>
                    {e.is_active ? "Active" : "Inactive"}
                  </span>
                  <button
                    type="button"
                    disabled={deletingId === e.id}
                    onClick={() => handleDelete(e)}
                    title="Delete employee"
                    className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
