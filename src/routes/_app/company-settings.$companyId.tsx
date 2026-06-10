import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, XCircle } from "lucide-react";
import { CompanyFieldsSection, type CompanyField } from "@/components/settings/company-fields-section";
import { JsonListSection } from "@/components/settings/json-list-section";
import { PhotoGallerySection } from "@/components/settings/photo-gallery-section";

export const Route = createFileRoute("/_app/company-settings/$companyId")({
  component: CompanyFullSettings,
});

const JUMP_LINKS = [
  { id: "company-details", label: "Company details" },
  { id: "venue-media", label: "Venue and media" },
  { id: "services-pricing", label: "Services and pricing" },
  { id: "event-types", label: "Event types" },
  { id: "sessions", label: "Sessions" },
  { id: "confirmation-message", label: "Confirmation message" },
  { id: "discount-rules", label: "Discount rules" },
] as const;

function ConfirmationMessageBlock({ companyId }: { companyId: string }) {
  const [row, setRow] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("companies").select("confirmation_reminder_lines,confirmation_closing_line,confirmation_auto_send")
      .eq("id", companyId).maybeSingle().then(({ data }) => setRow(data as any));
  }, [companyId]);

  if (!row) return <div className="text-sm text-muted-foreground p-6">Loading…</div>;
  const lines: string[] = Array.isArray(row.confirmation_reminder_lines) ? row.confirmation_reminder_lines : [];

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("companies").update({
      confirmation_reminder_lines: lines.filter((l) => l.trim().length > 0) as any,
      confirmation_closing_line: row.confirmation_closing_line || null,
      confirmation_auto_send: !!row.confirmation_auto_send,
    }).eq("id", companyId);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Saved ✓");
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Custom reminder lines</Label>
        <p className="text-xs text-muted-foreground mb-2">Shown under "Important Reminders" in the booking confirmation message.</p>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2">
              <Input value={l} onChange={(e) => setRow({ ...row, confirmation_reminder_lines: lines.map((x, j) => j === i ? e.target.value : x) })} />
              <Button variant="ghost" size="icon" onClick={() => setRow({ ...row, confirmation_reminder_lines: lines.filter((_, j) => j !== i) })} aria-label="Remove">
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRow({ ...row, confirmation_reminder_lines: [...lines, ""] })}>
            <Plus className="h-4 w-4 mr-1" /> Add reminder line
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Closing line</Label>
        <Textarea rows={2} value={row.confirmation_closing_line ?? ""}
          onChange={(e) => setRow({ ...row, confirmation_closing_line: e.target.value })}
          placeholder="We look forward to making your [event_type] truly memorable." />
        <p className="text-xs text-muted-foreground">Placeholders like <code>[event_type]</code>, <code>[company_name]</code> will be filled in.</p>
      </div>
      <div className="flex items-start justify-between gap-4 border rounded-md p-3">
        <div className="space-y-0.5 min-w-0">
          <Label>Auto-send confirmation on booking</Label>
          <p className="text-xs text-muted-foreground">If ON, the confirmation message is sent automatically. If OFF (recommended), staff sees a preview first.</p>
        </div>
        <input type="checkbox" className="h-5 w-5 mt-1"
          checked={!!row.confirmation_auto_send}
          onChange={(e) => setRow({ ...row, confirmation_auto_send: e.target.checked })} />
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}

function SectionShell({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function CompanyFullSettings() {
  const { companyId } = Route.useParams();
  const { role, companies, loading } = useAuth();
  const [companyName, setCompanyName] = useState<string>("");

  useEffect(() => {
    supabase.from("companies").select("name").eq("id", companyId).maybeSingle()
      .then(({ data }) => setCompanyName((data as any)?.name ?? "Company"));
  }, [companyId]);

  if (loading) return null;
  if (!role || (role !== "super_admin" && role !== "admin")) return <Navigate to="/dashboard" replace />;
  // Admins (non-super) can only open their own company
  if (role === "admin" && companies[0]?.id !== companyId) return <Navigate to="/settings" replace />;

  // ---- Field configs ----
  const companyDetailsFields: CompanyField[] = [
    { key: "name", label: "Company name" },
    { key: "type", label: "Type", type: "company_type" },
    { key: "full_address", label: "Full address", type: "textarea", rows: 3, fullWidth: true },
    { key: "company_phone", label: "Phone number" },
    { key: "wa_number", label: "WhatsApp Business number" },
    { key: "gstin", label: "GST number", placeholder: "22AAAAA0000A1Z5" },
    { key: "bank_account", label: "Bank account number" },
    { key: "ifsc", label: "IFSC code" },
    { key: "upi_id", label: "UPI ID" },
    { key: "google_maps_link", label: "Google Maps link", fullWidth: true },
    { key: "google_review_link", label: "Google review URL", fullWidth: true },
    { key: "max_capacity", label: "Max guest capacity", type: "number" },
    { key: "brand_color", label: "Company colour (hex)", placeholder: "#6366f1" },
    { key: "email", label: "Email", fullWidth: true },
    { key: "default_room", label: "Default hall / room name", placeholder: "e.g. Lotus Hall", fullWidth: true },
  ];

  const venueMediaFields: CompanyField[] = [
    { key: "meeting_contact_name", label: "Meeting contact name", placeholder: "Person who meets clients" },
    { key: "meeting_contact_phone", label: "Meeting contact phone", placeholder: "+91…" },
  ];

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button asChild variant="ghost" size="sm" className="min-h-10">
          <Link to="/settings"><ArrowLeft className="h-4 w-4 mr-1" /> Settings</Link>
        </Button>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Company settings</div>
          <h1 className="text-2xl font-semibold truncate">{companyName}</h1>
        </div>
      </div>

      {/* Sticky jump-link bar */}
      <div className="sticky top-0 z-10 -mx-2 px-2 py-2 bg-background/95 backdrop-blur border-b">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {JUMP_LINKS.map((l) => (
            <a key={l.id} href={`#${l.id}`}
              className="shrink-0 text-xs md:text-sm px-3 py-1.5 rounded-full border bg-card hover:bg-accent transition-colors">
              {l.label}
            </a>
          ))}
        </div>
      </div>

      <SectionShell id="company-details" title="Company details">
        <CompanyFieldsSection companyId={companyId} fields={companyDetailsFields} />
      </SectionShell>

      <SectionShell id="venue-media" title="Venue and media" description="Up to 10 photos plus meeting contact for venue visits.">
        <div className="space-y-6">
          <PhotoGallerySection companyId={companyId} />
          <CompanyFieldsSection companyId={companyId} fields={venueMediaFields} />
        </div>
      </SectionShell>

      <SectionShell id="services-pricing" title="Services and pricing" description="Base services used in the quotation builder.">
        <JsonListSection
          companyId={companyId}
          column="services_catalog"
          addLabel="Add service"
          fields={[
            { key: "name", label: "Service name", placeholder: "e.g. Hall rental" },
            { key: "price", label: "Base price (₹)", type: "number" },
            { key: "unit", label: "Unit", placeholder: "e.g. per event / per plate" },
          ]}
        />
      </SectionShell>

      <SectionShell id="event-types" title="Event types" description='"Other — describe" is always available at the end.'>
        <JsonListSection
          companyId={companyId}
          column="event_types"
          addLabel="Add event type"
          fields={[{ key: "label", label: "Label", placeholder: "e.g. Wedding reception" }]}
        />
      </SectionShell>

      <SectionShell id="communities" title="Communities" description='"Other — describe" is always available at the end.'>
        <JsonListSection
          companyId={companyId}
          column="communities"
          addLabel="Add community"
          fields={[{ key: "label", label: "Label", placeholder: "e.g. Tamil Brahmin" }]}
        />
      </SectionShell>

      <SectionShell id="sessions" title="Sessions" description="Populates the start-time dropdown in the intake form.">
        <JsonListSection
          companyId={companyId}
          column="sessions"
          addLabel="Add session"
          fields={[
            { key: "name", label: "Session name", placeholder: "e.g. Morning" },
            { key: "start_time", label: "Start", type: "time" },
            { key: "end_time", label: "End", type: "time" },
          ]}
        />
      </SectionShell>

      <SectionShell id="confirmation-message" title="Confirmation message" description="Reminder lines, closing line, and auto-send behaviour for the booking confirmation message sent to clients.">
        <ConfirmationMessageBlock companyId={companyId} />
      </SectionShell>

      <SectionShell id="discount-rules" title="Discount rules" description="Per-company caps. Super admin discount is unlimited and not editable.">
        <CompanyFieldsSection
          companyId={companyId}
          fields={[
            { key: "staff_max_discount_percent", label: "Staff max %", type: "number", suffix: "%", description: "Default 5." },
            { key: "admin_max_discount_percent", label: "Admin max %", type: "number", suffix: "%", description: "Default 15." },
            { key: "gst_percent", label: "GST %", type: "number", suffix: "%" },
            { key: "require_discount_reason", label: "Require reason for discount", type: "switch", description: "Default ON." },
          ]}
        />
        <p className="text-xs text-muted-foreground mt-3">Per-staff quotation-send permissions are coming in the next chunk.</p>
      </SectionShell>
    </div>
  );
}
