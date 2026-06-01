
-- ============== ENUMS ==============
CREATE TYPE public.lead_source AS ENUM ('inbound_call','walkin','referral','portal','manual');
CREATE TYPE public.lead_score  AS ENUM ('hot','warm','cold');
CREATE TYPE public.lead_status AS ENUM ('new','in_progress','neutral','positive','negative','closed','unresponsive','locked');
CREATE TYPE public.activity_type AS ENUM ('call','whatsapp','note','status_change','assignment','transfer','view','system','photo','intake','quotation','payment');
CREATE TYPE public.transfer_status AS ENUM ('pending','approved','rejected','auto_approved');
CREATE TYPE public.notification_type AS ENUM ('new_lead','follow_up','transfer','payment','event_reminder','low_rating','system');

-- ============== PROFILES ADDITIONS ==============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fcm_token text,
  ADD COLUMN IF NOT EXISTS phone_masked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- ============== LEADS ==============
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  full_name text NOT NULL,
  phone text NOT NULL,
  source public.lead_source NOT NULL DEFAULT 'manual',
  referred_by_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  referred_by_name text,
  language text NOT NULL DEFAULT 'English',
  lead_score public.lead_score NOT NULL DEFAULT 'warm',
  status public.lead_status NOT NULL DEFAULT 'new',
  is_blacklisted boolean NOT NULL DEFAULT false,
  blacklist_reason text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  follow_up_count integer NOT NULL DEFAULT 0,
  max_follow_up_attempts integer NOT NULL DEFAULT 5,
  notes text,
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leads_phone_company_unique UNIQUE (phone, company_id)
);

CREATE INDEX idx_leads_phone ON public.leads(phone);
CREATE INDEX idx_leads_company_id ON public.leads(company_id);
CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX idx_leads_deleted_at ON public.leads(deleted_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin all leads" ON public.leads FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "company members view leads" ON public.leads FOR SELECT TO authenticated
  USING (company_id = private.current_company_id());

CREATE POLICY "company members insert leads" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (company_id = private.current_company_id());

CREATE POLICY "company members update leads" ON public.leads FOR UPDATE TO authenticated
  USING (company_id = private.current_company_id())
  WITH CHECK (company_id = private.current_company_id());

-- ============== ACTIVITY LOGS ==============
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  action text NOT NULL,
  action_type public.activity_type NOT NULL DEFAULT 'system',
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  metadata jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_logs_lead_id ON public.activity_logs(lead_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin activity logs" ON public.activity_logs FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "company view activity logs" ON public.activity_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.company_id = private.current_company_id()));

CREATE POLICY "company insert activity logs" ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.company_id = private.current_company_id()));

-- ============== TRANSFER REQUESTS ==============
CREATE TABLE public.transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_company_id uuid NOT NULL REFERENCES public.companies(id),
  to_company_id uuid NOT NULL REFERENCES public.companies(id),
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  requirement_summary text NOT NULL CHECK (char_length(requirement_summary) >= 20),
  reason text NOT NULL,
  status public.transfer_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_transfer_requests_status ON public.transfer_requests(status);
CREATE INDEX idx_transfer_requests_lead_id ON public.transfer_requests(lead_id);

GRANT SELECT, INSERT, UPDATE ON public.transfer_requests TO authenticated;
GRANT ALL ON public.transfer_requests TO service_role;
ALTER TABLE public.transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin transfers" ON public.transfer_requests FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "company view own transfers" ON public.transfer_requests FOR SELECT TO authenticated
  USING (from_company_id = private.current_company_id() OR to_company_id = private.current_company_id());

CREATE POLICY "company create transfers" ON public.transfer_requests FOR INSERT TO authenticated
  WITH CHECK (from_company_id = private.current_company_id() AND requested_by = auth.uid());

-- ============== NOTIFICATIONS ==============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  type public.notification_type NOT NULL DEFAULT 'system',
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications select" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "super admin notifications insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'super_admin') OR user_id = auth.uid());

-- ============== FOLLOW UPS ==============
CREATE TABLE public.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  note text,
  is_sent boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_follow_ups_lead_id ON public.follow_ups(lead_id);
CREATE INDEX idx_follow_ups_scheduled_at ON public.follow_ups(scheduled_at);
CREATE INDEX idx_follow_ups_pending ON public.follow_ups(scheduled_at, is_sent) WHERE is_sent = false;

GRANT SELECT, INSERT, UPDATE ON public.follow_ups TO authenticated;
GRANT ALL ON public.follow_ups TO service_role;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin follow ups" ON public.follow_ups FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "company view follow ups" ON public.follow_ups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.company_id = private.current_company_id()));

CREATE POLICY "company insert follow ups" ON public.follow_ups FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.company_id = private.current_company_id()));

CREATE POLICY "company update follow ups" ON public.follow_ups FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.company_id = private.current_company_id()));

-- ============== TRIGGERS ==============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_transfer_updated BEFORE UPDATE ON public.transfer_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============== REALTIME ==============
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
