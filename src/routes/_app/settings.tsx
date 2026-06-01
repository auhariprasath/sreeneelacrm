import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, Users, Filter, CalendarRange, Tags, Plus, Percent, Bell, CalendarCheck,
  FileText, XCircle, MessageSquare, Briefcase, Lock, ListChecks,
} from "lucide-react";
import { StaffSection } from "@/components/settings/staff-section";
import { JsonListSection } from "@/components/settings/json-list-section";
import { CompanyFieldsSection, type CompanyField } from "@/components/settings/company-fields-section";
import { TaskTemplatesSection } from "@/components/settings/task-templates-section";


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
  { id: "task-templates", label: "Task templates", icon: ListChecks, superOnly: false },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

interface CompanyRow {
  id: string;
  name: string;
  type: string;
  gstin: string | null;
  wa_number: string | null;
  email: string | null;
  address: string | null;
  bank_account: string | null;
  ifsc: string | null;
  upi_id: string | null;
  google_review_link: string | null;
  max_capacity: number | null;
  peak_season_dates: any;
  default_follow_up_minutes: number;
  default_callback_time: string;
  max_follow_up_attempts: number;
  cancellation_policy: string | null;
}

function CompanySection({ companyId }: { companyId: string }) {
  const [data, setData] = useState<Partial<CompanyRow> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.from("companies").select("*").eq("id", companyId).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error) toast.error("Couldn't load company details");
      setData(data as any);
    });
    return () => { active = false; };
  }, [companyId]);

  if (!data) return <div className="text-sm text-muted-foreground p-6">Loading…</div>;

  const update = (k: keyof CompanyRow, v: any) => setData((d) => ({ ...(d ?? {}), [k]: v }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("companies").update({
      name: data.name,
      gstin: data.gstin,
      wa_number: data.wa_number,
      email: data.email,
      address: data.address,
      bank_account: data.bank_account,
      ifsc: data.ifsc,
      upi_id: data.upi_id,
      google_review_link: data.google_review_link,
      max_capacity: data.max_capacity ? Number(data.max_capacity) : null,
    }).eq("id", companyId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saved ✓");
  };

  const fields: [keyof CompanyRow, string, string?][] = [
    ["name", "Company name"],
    ["gstin", "GSTIN"],
    ["wa_number", "WhatsApp number"],
    ["email", "Email"],
    ["bank_account", "Bank account"],
    ["ifsc", "IFSC"],
    ["upi_id", "UPI ID"],
    ["google_review_link", "Google review link"],
    ["max_capacity", "Max capacity (guests)", "number"],
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map(([key, label, type]) => (
        <div key={key} className="space-y-1.5">
          <Label>{label}</Label>
          <Input
            type={type ?? "text"}
            value={(data as any)[key] ?? ""}
            onChange={(e) => update(key, e.target.value)}
            placeholder={`Enter ${label.toLowerCase()}`}
          />
        </div>
      ))}
      <div className="space-y-1.5 md:col-span-2">
        <Label>Address</Label>
        <Textarea rows={3} value={data.address ?? ""} onChange={(e) => update("address", e.target.value)} placeholder="Full venue address" />
      </div>
      <div className="md:col-span-2 flex justify-end gap-2">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}

function RemindersSection({ companyId }: { companyId: string | undefined }) {
  const [row, setRow] = useState<Partial<CompanyRow> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    supabase.from("companies").select("default_follow_up_minutes,default_callback_time,max_follow_up_attempts").eq("id", companyId).maybeSingle().then(({ data }) => setRow(data as any));
  }, [companyId]);

  if (!companyId) return <div className="text-sm text-muted-foreground p-6">Select a company first.</div>;
  if (!row) return <div className="text-sm text-muted-foreground p-6">Loading…</div>;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("companies").update({
      default_follow_up_minutes: Number(row.default_follow_up_minutes) || 60,
      default_callback_time: row.default_callback_time || "10:00",
      max_follow_up_attempts: Number(row.max_follow_up_attempts) || 5,
    }).eq("id", companyId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saved ✓");
  };

  // Convert minutes to HH:MM for time picker default-display
  const minutesToHHMM = (m: number) => {
    const h = Math.floor(m / 60); const mm = m % 60;
    return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };
  const hhmmToMinutes = (s: string) => {
    const [h, m] = s.split(":").map(Number); return (h || 0) * 60 + (m || 0);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label>Max follow-up attempts</Label>
        <Input type="number" min={1} value={row.max_follow_up_attempts ?? 5} onChange={(e) => setRow({ ...row, max_follow_up_attempts: Number(e.target.value) })} />
      </div>
      <div className="space-y-1.5">
        <Label>Default follow-up time</Label>
        <Input type="time" value={minutesToHHMM(row.default_follow_up_minutes ?? 60)} onChange={(e) => setRow({ ...row, default_follow_up_minutes: hhmmToMinutes(e.target.value) })} />
        <p className="text-xs text-muted-foreground">Time between automatic follow-ups.</p>
      </div>
      <div className="space-y-1.5">
        <Label>Default callback time</Label>
        <Input type="time" value={row.default_callback_time ?? "10:00"} onChange={(e) => setRow({ ...row, default_callback_time: e.target.value })} />
        <p className="text-xs text-muted-foreground">Default time for next-day callbacks.</p>
      </div>
      <div className="md:col-span-2 flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}

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
  const [section, setSection] = useState<SectionId>("company");
  const [companyTab, setCompanyTab] = useState(companies[0]?.id ?? "");

  useEffect(() => {
    if (!companyTab && companies[0]) setCompanyTab(companies[0].id);
  }, [companies, companyTab]);

  if (loading) return null;
  if (!role || (role !== "super_admin" && role !== "admin")) return <Navigate to="/dashboard" replace />;

  const visible = SECTIONS.filter((s) => role === "super_admin" || !s.superOnly);
  const activeCompanyId = role === "super_admin" ? companyTab : companies[0]?.id;

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
                  <TabsList className="flex-wrap">{companies.map((c) => <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>)}</TabsList>
                </Tabs>
              )}
              {activeCompanyId ? <CompanySection companyId={activeCompanyId} /> : <p className="text-sm text-muted-foreground">No company.</p>}
            </CardContent>
          </Card>
        );
      case "reminders":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Reminder timing</CardTitle>
              <CardDescription>Default cadences for follow-ups and callbacks.</CardDescription>
            </CardHeader>
            <CardContent>
              {role === "super_admin" && companies.length > 0 && (
                <Tabs value={companyTab} onValueChange={setCompanyTab} className="mb-6">
                  <TabsList className="flex-wrap">{companies.map((c) => <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>)}</TabsList>
                </Tabs>
              )}
              <RemindersSection companyId={activeCompanyId} />
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
              {role === "super_admin" && companies.length > 0 && (
                <Tabs value={companyTab} onValueChange={setCompanyTab} className="mb-6">
                  <TabsList className="flex-wrap">{companies.map((c) => <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>)}</TabsList>
                </Tabs>
              )}
              <PeakSection companyId={activeCompanyId} />
            </CardContent>
          </Card>
        );
      case "staff":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Staff & roles</CardTitle>
              <CardDescription>Manage users, deactivate accounts, control phone masking and auto-approve transfers.</CardDescription>
            </CardHeader>
            <CardContent>
              {role === "super_admin" && companies.length > 0 && (
                <Tabs value={companyTab} onValueChange={setCompanyTab} className="mb-6">
                  <TabsList className="flex-wrap">{companies.map((c) => <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>)}</TabsList>
                </Tabs>
              )}
              <StaffSection companyId={activeCompanyId} />
            </CardContent>
          </Card>
        );
      case "sessions":
      case "event-types":
      case "addons":
      case "drop": {
        const config = {
          sessions: {
            title: "Sessions & slots",
            desc: "Available sessions for this company. Populates start time dropdown in the intake form.",
            column: "sessions",
            addLabel: "Add session",
            fields: [
              { key: "name", label: "Session name", placeholder: "e.g. Morning" },
              { key: "start_time", label: "Start", type: "time" as const },
              { key: "end_time", label: "End", type: "time" as const },
            ],
          },
          "event-types": {
            title: "Event types",
            desc: "Populates event type dropdown in the intake form. \"Other — describe\" is always available.",
            column: "event_types",
            addLabel: "Add event type",
            fields: [{ key: "label", label: "Label", placeholder: "e.g. Wedding reception" }],
          },
          addons: {
            title: "Add-ons",
            desc: "Add-ons offered for this company. Custom add-ons entered during intake auto-save here.",
            column: "addons_catalog",
            addLabel: "Add add-on",
            fields: [
              { key: "name", label: "Name", placeholder: "e.g. DJ" },
              { key: "price", label: "Price (₹)", type: "number" as const },
            ],
          },
          drop: {
            title: "Drop reasons",
            desc: "Reasons shown when staff marks a lead as not interested.",
            column: "drop_reasons",
            addLabel: "Add reason",
            fields: [{ key: "label", label: "Reason", placeholder: "e.g. Budget too low" }],
          },
        }[section as "sessions" | "event-types" | "addons" | "drop"];
        return (
          <Card>
            <CardHeader>
              <CardTitle>{config.title}</CardTitle>
              <CardDescription>{config.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              {role === "super_admin" && companies.length > 0 && (
                <Tabs value={companyTab} onValueChange={setCompanyTab} className="mb-6">
                  <TabsList className="flex-wrap">{companies.map((c) => <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>)}</TabsList>
                </Tabs>
              )}
              <JsonListSection
                companyId={activeCompanyId}
                column={config.column}
                fields={config.fields}
                addLabel={config.addLabel}
              />
            </CardContent>
          </Card>
        );
      }
      case "services": {
        return (
          <Card>
            <CardHeader>
              <CardTitle>Services & pricing</CardTitle>
              <CardDescription>Base services offered. Used in the quotation builder.</CardDescription>
            </CardHeader>
            <CardContent>
              {role === "super_admin" && companies.length > 0 && (
                <Tabs value={companyTab} onValueChange={setCompanyTab} className="mb-6">
                  <TabsList className="flex-wrap">{companies.map((c) => <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>)}</TabsList>
                </Tabs>
              )}
              <JsonListSection
                companyId={activeCompanyId}
                column="services_catalog"
                addLabel="Add service"
                fields={[
                  { key: "name", label: "Service name", placeholder: "e.g. Hall rental" },
                  { key: "price", label: "Base price (₹)", type: "number" },
                  { key: "unit", label: "Unit", placeholder: "e.g. per event / per plate" },
                ]}
              />
            </CardContent>
          </Card>
        );
      }
      case "discounts": {
        const fields: CompanyField[] = [
          { key: "staff_max_discount_percent", label: "Max discount – Staff", type: "number", suffix: "%", description: "Maximum discount staff can apply without approval." },
          { key: "admin_max_discount_percent", label: "Max discount – Admin", type: "number", suffix: "%", description: "Maximum discount admins can apply." },
          { key: "gst_percent", label: "GST %", type: "number", suffix: "%", description: "Default GST applied to quotations." },
          { key: "require_discount_reason", label: "Require reason for discount", type: "switch", description: "Staff must enter a reason when applying any discount." },
        ];
        return (
          <Card>
            <CardHeader>
              <CardTitle>Discount rules & GST</CardTitle>
              <CardDescription>Caps, GST defaults and discount reason policy.</CardDescription>
            </CardHeader>
            <CardContent>
              {role === "super_admin" && companies.length > 0 && (
                <Tabs value={companyTab} onValueChange={setCompanyTab} className="mb-6">
                  <TabsList className="flex-wrap">{companies.map((c) => <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>)}</TabsList>
                </Tabs>
              )}
              <CompanyFieldsSection companyId={activeCompanyId} fields={fields} />
            </CardContent>
          </Card>
        );
      }
      case "cancellation": {
        const fields: CompanyField[] = [
          { key: "refund_over_30_percent", label: "Refund – Over 30 days before event", type: "number", suffix: "%" },
          { key: "refund_15_30_percent", label: "Refund – 15 to 30 days before event", type: "number", suffix: "%" },
          { key: "refund_under_15_percent", label: "Refund – Under 15 days before event", type: "number", suffix: "%" },
          { key: "cancellation_policy", label: "Cancellation policy text", type: "textarea", rows: 5, placeholder: "Shown on quotations and booking confirmations.", fullWidth: true },
        ];
        return (
          <Card>
            <CardHeader>
              <CardTitle>Cancellation policy</CardTitle>
              <CardDescription>Refund tiers and the policy text printed on documents.</CardDescription>
            </CardHeader>
            <CardContent>
              {role === "super_admin" && companies.length > 0 && (
                <Tabs value={companyTab} onValueChange={setCompanyTab} className="mb-6">
                  <TabsList className="flex-wrap">{companies.map((c) => <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>)}</TabsList>
                </Tabs>
              )}
              <CompanyFieldsSection companyId={activeCompanyId} fields={fields} />
            </CardContent>
          </Card>
        );
      }
      case "wa": {
        const tokens = "Available tokens: {{client_name}}, {{event_date}}, {{venue}}, {{amount}}, {{balance}}, {{company_name}}, {{quotation_number}}";
        const fields: CompanyField[] = [
          { key: "wa_template_payment_reminder", label: "Payment reminder", type: "textarea", rows: 4, fullWidth: true, description: tokens, placeholder: "Hi {{client_name}}, this is a reminder for the pending payment of ₹{{balance}} for your event on {{event_date}}." },
          { key: "wa_template_thank_you", label: "Thank you / booking confirmation", type: "textarea", rows: 4, fullWidth: true, description: tokens, placeholder: "Thank you {{client_name}}! Your booking for {{event_date}} at {{venue}} is confirmed." },
          { key: "wa_template_reschedule", label: "Reschedule notification", type: "textarea", rows: 4, fullWidth: true, description: tokens },
          { key: "wa_template_competing_leads", label: "Competing leads notification", type: "textarea", rows: 4, fullWidth: true, description: tokens },
          { key: "auto_wa_on_reschedule", label: "Send WhatsApp automatically on reschedule", type: "switch" },
          { key: "auto_notify_competing_leads", label: "Auto-notify competing leads when a slot frees up", type: "switch" },
          { key: "auto_sms_fallback", label: "Send SMS fallback if WhatsApp fails", type: "switch" },
        ];
        return (
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp templates</CardTitle>
              <CardDescription>Message templates used by the reminder engine and booking flows.</CardDescription>
            </CardHeader>
            <CardContent>
              {role === "super_admin" && companies.length > 0 && (
                <Tabs value={companyTab} onValueChange={setCompanyTab} className="mb-6">
                  <TabsList className="flex-wrap">{companies.map((c) => <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>)}</TabsList>
                </Tabs>
              )}
              <CompanyFieldsSection companyId={activeCompanyId} fields={fields} />
            </CardContent>
          </Card>
        );
      }
      default: {
        const titleMap = Object.fromEntries(SECTIONS.map((s) => [s.id, s.label]));
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{titleMap[section]}</CardTitle>
                <CardDescription>Coming in a later chunk.</CardDescription>
              </div>
              <Button><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground border border-dashed rounded-md p-8 text-center">No entries yet.</div>
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
            Some master settings are restricted to Super Admin.
          </div>
        )}
      </aside>
      <div className="flex-1 min-w-0">{renderSection()}</div>
    </div>
  );
}
