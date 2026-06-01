
-- Phase 6 schema additions

-- 1. feedback table
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  company_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_company ON public.feedback(company_id);
CREATE INDEX idx_feedback_booking ON public.feedback(booking_id);

GRANT SELECT ON public.feedback TO anon;
GRANT SELECT, INSERT, UPDATE ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Public can insert feedback (used by /feedback/[booking_id] page) — booking_id is the share token
CREATE POLICY "public insert feedback" ON public.feedback FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public view feedback by booking" ON public.feedback FOR SELECT TO anon USING (true);
CREATE POLICY "company view feedback" ON public.feedback FOR SELECT TO authenticated USING (company_id = private.current_company_id());
CREATE POLICY "super admin feedback" ON public.feedback FOR ALL TO authenticated USING (private.has_role(auth.uid(),'super_admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role));

-- 2. win_loss_log
CREATE TYPE public.win_loss_outcome AS ENUM ('won','lost');

CREATE TABLE public.win_loss_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  company_id uuid NOT NULL,
  outcome public.win_loss_outcome NOT NULL,
  drop_reason text,
  competitor_name text,
  amount_value numeric,
  closed_by uuid,
  closed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_win_loss_company ON public.win_loss_log(company_id);
CREATE INDEX idx_win_loss_lead ON public.win_loss_log(lead_id);

GRANT SELECT, INSERT ON public.win_loss_log TO authenticated;
GRANT ALL ON public.win_loss_log TO service_role;
ALTER TABLE public.win_loss_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company view win_loss" ON public.win_loss_log FOR SELECT TO authenticated USING (company_id = private.current_company_id());
CREATE POLICY "company insert win_loss" ON public.win_loss_log FOR INSERT TO authenticated WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "super admin win_loss" ON public.win_loss_log FOR ALL TO authenticated USING (private.has_role(auth.uid(),'super_admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role));

-- 3. companies — Phase 6 settings additions
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS company_phone text,
  ADD COLUMN IF NOT EXISTS force_majeure_note text,
  ADD COLUMN IF NOT EXISTS feedback_wa_delay_hours integer NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS reengagement_delay_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS reengagement_auto_send boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS balance_reminder_days_before integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS wa_template_feedback text,
  ADD COLUMN IF NOT EXISTS wa_template_reengagement text;

-- 4. bookings — feedback scheduling + re-engagement scheduling + completion meta
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid,
  ADD COLUMN IF NOT EXISTS feedback_wa_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS feedback_wa_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reengagement_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reengagement_sent_at timestamptz;

-- 5. profiles — track session for login log
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_logout_at timestamptz;

-- 6. login_log
CREATE TABLE public.login_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid,
  login_at timestamptz NOT NULL DEFAULT now(),
  logout_at timestamptz,
  device_type text,
  user_agent text
);
CREATE INDEX idx_login_log_user ON public.login_log(user_id);
CREATE INDEX idx_login_log_login_at ON public.login_log(login_at);

GRANT SELECT, INSERT, UPDATE ON public.login_log TO authenticated;
GRANT ALL ON public.login_log TO service_role;
ALTER TABLE public.login_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own login_log insert" ON public.login_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own login_log update" ON public.login_log FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own login_log select" ON public.login_log FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "super admin login_log" ON public.login_log FOR ALL TO authenticated USING (private.has_role(auth.uid(),'super_admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role));

-- 7. referral_loyalty_flags (SA tracks "Benefit sent" per referrer lead)
CREATE TABLE public.referral_loyalty_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_lead_id uuid NOT NULL UNIQUE,
  benefit_sent boolean NOT NULL DEFAULT false,
  benefit_sent_at timestamptz,
  flagged_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.referral_loyalty_flags TO authenticated;
GRANT ALL ON public.referral_loyalty_flags TO service_role;
ALTER TABLE public.referral_loyalty_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin loyalty flags" ON public.referral_loyalty_flags FOR ALL TO authenticated USING (private.has_role(auth.uid(),'super_admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "admin view loyalty flags" ON public.referral_loyalty_flags FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER touch_loyalty_flags BEFORE UPDATE ON public.referral_loyalty_flags FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
