
-- ===== ENUMS =====
CREATE TYPE public.vendor_status_stage AS ENUM ('packed','traveling','arrived','setup_done');
CREATE TYPE public.vendor_status_source AS ENUM ('tap_link','manual_staff');
CREATE TYPE public.call_outcome_type AS ENUM ('interested','meeting_scheduled','callback_requested','other','not_interested');
CREATE TYPE public.venue_meeting_status AS ENUM ('scheduled','reminder_sent','completed','cancelled','rescheduled');
CREATE TYPE public.payment_method_type AS ENUM ('manual','razorpay');

-- ===== COMPANIES NEW FIELDS =====
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS full_address text,
  ADD COLUMN IF NOT EXISTS google_maps_link text,
  ADD COLUMN IF NOT EXISTS meeting_contact_name text,
  ADD COLUMN IF NOT EXISTS meeting_contact_phone text,
  ADD COLUMN IF NOT EXISTS venue_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_method public.payment_method_type NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS razorpay_key_id text,
  ADD COLUMN IF NOT EXISTS razorpay_key_secret text,
  ADD COLUMN IF NOT EXISTS razorpay_test_mode boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vendor_status_reminder_hours integer NOT NULL DEFAULT 6;

-- ===== VENDOR STATUS UPDATES =====
CREATE TABLE public.vendor_status_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_vendor_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  company_id uuid NOT NULL,
  status public.vendor_status_stage NOT NULL,
  updated_via public.vendor_status_source NOT NULL,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_status_updates TO authenticated;
GRANT SELECT, INSERT ON public.vendor_status_updates TO anon;
GRANT ALL ON public.vendor_status_updates TO service_role;
ALTER TABLE public.vendor_status_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company view vendor_status_updates" ON public.vendor_status_updates
  FOR SELECT TO authenticated USING (company_id = private.current_company_id());
CREATE POLICY "company insert vendor_status_updates" ON public.vendor_status_updates
  FOR INSERT TO authenticated WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "super admin vendor_status_updates" ON public.vendor_status_updates
  FOR ALL TO authenticated USING (private.has_role(auth.uid(),'super_admin'))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'));
-- Public can read/insert via token route (validated server-side); for simplicity allow anon insert with constraint by booking_vendor_id existence
CREATE POLICY "public read vendor_status_updates" ON public.vendor_status_updates
  FOR SELECT TO anon USING (true);
CREATE POLICY "public insert vendor_status_updates" ON public.vendor_status_updates
  FOR INSERT TO anon WITH CHECK (
    EXISTS (SELECT 1 FROM public.booking_vendors bv WHERE bv.id = booking_vendor_id AND bv.booking_id = booking_id AND bv.vendor_id = vendor_id)
  );

CREATE INDEX idx_vsu_booking_vendor ON public.vendor_status_updates(booking_vendor_id);
CREATE INDEX idx_vsu_booking ON public.vendor_status_updates(booking_id);

-- Add status link token to booking_vendors
ALTER TABLE public.booking_vendors
  ADD COLUMN IF NOT EXISTS status_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS status_reminder_sent_at timestamptz;

-- ===== CALL OUTCOMES =====
CREATE TABLE public.call_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  company_id uuid NOT NULL,
  follow_up_id uuid,
  outcome public.call_outcome_type NOT NULL,
  notes text,
  next_action text,
  drop_reason text,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_outcomes TO authenticated;
GRANT ALL ON public.call_outcomes TO service_role;
ALTER TABLE public.call_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company view call_outcomes" ON public.call_outcomes
  FOR SELECT TO authenticated USING (company_id = private.current_company_id());
CREATE POLICY "company insert call_outcomes" ON public.call_outcomes
  FOR INSERT TO authenticated WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "super admin call_outcomes" ON public.call_outcomes
  FOR ALL TO authenticated USING (private.has_role(auth.uid(),'super_admin'))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'));

CREATE INDEX idx_call_outcomes_lead ON public.call_outcomes(lead_id);
CREATE INDEX idx_call_outcomes_company ON public.call_outcomes(company_id, created_at DESC);

-- ===== VENUE MEETINGS =====
CREATE TABLE public.venue_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  company_id uuid NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  contact_person_name text,
  contact_person_phone text,
  status public.venue_meeting_status NOT NULL DEFAULT 'scheduled',
  outcome_recorded boolean NOT NULL DEFAULT false,
  notes text,
  message_sent text,
  photos_sent jsonb NOT NULL DEFAULT '[]'::jsonb,
  reminder_1day_sent_at timestamptz,
  reminder_now_sent_at timestamptz,
  outcome_prompt_sent_at timestamptz,
  created_by uuid,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_meetings TO authenticated;
GRANT ALL ON public.venue_meetings TO service_role;
ALTER TABLE public.venue_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company view venue_meetings" ON public.venue_meetings
  FOR SELECT TO authenticated USING (company_id = private.current_company_id());
CREATE POLICY "company insert venue_meetings" ON public.venue_meetings
  FOR INSERT TO authenticated WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "company update venue_meetings" ON public.venue_meetings
  FOR UPDATE TO authenticated USING (company_id = private.current_company_id())
  WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "super admin venue_meetings" ON public.venue_meetings
  FOR ALL TO authenticated USING (private.has_role(auth.uid(),'super_admin'))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER venue_meetings_updated_at BEFORE UPDATE ON public.venue_meetings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_venue_meetings_lead ON public.venue_meetings(lead_id);
CREATE INDEX idx_venue_meetings_company_date ON public.venue_meetings(company_id, scheduled_date);
