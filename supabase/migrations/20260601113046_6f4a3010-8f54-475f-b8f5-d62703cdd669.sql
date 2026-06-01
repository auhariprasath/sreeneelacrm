-- Phase 5: Tasks, Vendors, Event Day, Campaigns

-- Enums
CREATE TYPE public.task_status AS ENUM ('pending','in_progress','done','overdue');
CREATE TYPE public.task_priority AS ENUM ('low','medium','high');
CREATE TYPE public.event_day_log_type AS ENUM ('amendment','complaint','vendor_no_show','force_majeure','note');
CREATE TYPE public.event_day_severity AS ENUM ('low','medium','high');
CREATE TYPE public.event_day_status AS ENUM ('open','in_progress','resolved','closed');
CREATE TYPE public.campaign_channel AS ENUM ('whatsapp','sms','both');
CREATE TYPE public.campaign_status AS ENUM ('draft','sent','completed');
CREATE TYPE public.campaign_lead_channel AS ENUM ('whatsapp','sms');
CREATE TYPE public.campaign_lead_status AS ENUM ('pending','sent','delivered','failed');

-- Add company-level + staff settings
ALTER TABLE public.companies
  ADD COLUMN task_templates jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN auto_notify_vendor_on_assign boolean NOT NULL DEFAULT true,
  ADD COLUMN auto_notify_backup_on_leave boolean NOT NULL DEFAULT true,
  ADD COLUMN auto_reassign_overdue_on_leave boolean NOT NULL DEFAULT true,
  ADD COLUMN auto_wa_client_on_leave boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN on_leave boolean NOT NULL DEFAULT false,
  ADD COLUMN backup_staff_id uuid;

-- TASKS
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  company_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  assigned_to uuid,
  due_at timestamptz NOT NULL,
  status public.task_status NOT NULL DEFAULT 'pending',
  is_from_template boolean NOT NULL DEFAULT true,
  priority public.task_priority NOT NULL DEFAULT 'medium',
  completed_at timestamptz,
  completed_by uuid,
  notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin tasks" ON public.tasks FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'));
CREATE POLICY "company view tasks" ON public.tasks FOR SELECT TO authenticated
  USING (company_id = private.current_company_id());
CREATE POLICY "company insert tasks" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "company update tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (company_id = private.current_company_id())
  WITH CHECK (company_id = private.current_company_id());
CREATE TRIGGER tasks_touch BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_tasks_company_due ON public.tasks(company_id, due_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_booking ON public.tasks(booking_id) WHERE deleted_at IS NULL;

-- VENDORS
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  service_type text NOT NULL,
  wa_number text,
  email text,
  standard_rate numeric,
  rating numeric,
  rating_count integer NOT NULL DEFAULT 0,
  total_bookings integer NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin vendors" ON public.vendors FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'));
CREATE POLICY "company view vendors" ON public.vendors FOR SELECT TO authenticated
  USING (company_id = private.current_company_id());
CREATE POLICY "company insert vendors" ON public.vendors FOR INSERT TO authenticated
  WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "company update vendors" ON public.vendors FOR UPDATE TO authenticated
  USING (company_id = private.current_company_id())
  WITH CHECK (company_id = private.current_company_id());
CREATE TRIGGER vendors_touch BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_vendors_company ON public.vendors(company_id) WHERE deleted_at IS NULL;

-- BOOKING VENDORS
CREATE TABLE public.booking_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  company_id uuid NOT NULL,
  service_description text,
  amount_agreed numeric,
  amount_paid numeric NOT NULL DEFAULT 0,
  confirmed boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz,
  no_show boolean NOT NULL DEFAULT false,
  no_show_logged_at timestamptz,
  no_show_note text,
  backup_vendor_suggested boolean NOT NULL DEFAULT false,
  rating numeric,
  rating_comment text,
  rated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_vendors TO authenticated;
GRANT ALL ON public.booking_vendors TO service_role;
ALTER TABLE public.booking_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin booking_vendors" ON public.booking_vendors FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'));
CREATE POLICY "company view booking_vendors" ON public.booking_vendors FOR SELECT TO authenticated
  USING (company_id = private.current_company_id());
CREATE POLICY "company insert booking_vendors" ON public.booking_vendors FOR INSERT TO authenticated
  WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "company update booking_vendors" ON public.booking_vendors FOR UPDATE TO authenticated
  USING (company_id = private.current_company_id())
  WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "company delete booking_vendors" ON public.booking_vendors FOR DELETE TO authenticated
  USING (company_id = private.current_company_id());
CREATE INDEX idx_bv_booking ON public.booking_vendors(booking_id);
CREATE INDEX idx_bv_vendor ON public.booking_vendors(vendor_id);

-- EVENT DAY LOGS
CREATE TABLE public.event_day_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  company_id uuid NOT NULL,
  log_type public.event_day_log_type NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  severity public.event_day_severity,
  metadata jsonb,
  logged_by uuid,
  assigned_to uuid,
  status public.event_day_status NOT NULL DEFAULT 'open',
  resolution_note text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_day_logs TO authenticated;
GRANT ALL ON public.event_day_logs TO service_role;
ALTER TABLE public.event_day_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin event_day_logs" ON public.event_day_logs FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'));
CREATE POLICY "company view event_day_logs" ON public.event_day_logs FOR SELECT TO authenticated
  USING (company_id = private.current_company_id());
CREATE POLICY "company insert event_day_logs" ON public.event_day_logs FOR INSERT TO authenticated
  WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "company update event_day_logs" ON public.event_day_logs FOR UPDATE TO authenticated
  USING (company_id = private.current_company_id())
  WITH CHECK (company_id = private.current_company_id());
CREATE INDEX idx_edl_booking ON public.event_day_logs(booking_id);

-- CAMPAIGNS
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_by uuid,
  name text NOT NULL,
  segment_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  message text NOT NULL,
  channel public.campaign_channel NOT NULL DEFAULT 'whatsapp',
  sms_fallback boolean NOT NULL DEFAULT true,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  total_leads integer NOT NULL DEFAULT 0,
  total_sent integer NOT NULL DEFAULT 0,
  total_delivered integer NOT NULL DEFAULT 0,
  total_failed integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'));
CREATE POLICY "company view campaigns" ON public.campaigns FOR SELECT TO authenticated
  USING (company_id = private.current_company_id());
CREATE POLICY "admin manage campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') AND company_id = private.current_company_id())
  WITH CHECK (private.has_role(auth.uid(),'admin') AND company_id = private.current_company_id());
CREATE TRIGGER campaigns_touch BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_campaigns_company ON public.campaigns(company_id) WHERE deleted_at IS NULL;

-- CAMPAIGN LEADS
CREATE TABLE public.campaign_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  company_id uuid NOT NULL,
  channel_used public.campaign_lead_channel NOT NULL,
  status public.campaign_lead_status NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  delivered_at timestamptz,
  error_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_leads TO authenticated;
GRANT ALL ON public.campaign_leads TO service_role;
ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin campaign_leads" ON public.campaign_leads FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'));
CREATE POLICY "company view campaign_leads" ON public.campaign_leads FOR SELECT TO authenticated
  USING (company_id = private.current_company_id());
CREATE POLICY "company insert campaign_leads" ON public.campaign_leads FOR INSERT TO authenticated
  WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "company update campaign_leads" ON public.campaign_leads FOR UPDATE TO authenticated
  USING (company_id = private.current_company_id())
  WITH CHECK (company_id = private.current_company_id());
CREATE INDEX idx_cl_campaign ON public.campaign_leads(campaign_id);
CREATE INDEX idx_cl_lead ON public.campaign_leads(lead_id);
