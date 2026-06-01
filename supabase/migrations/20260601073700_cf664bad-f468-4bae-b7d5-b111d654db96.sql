
-- Enums
CREATE TYPE public.quotation_status AS ENUM ('draft','sent','agreed','revised','declined');
CREATE TYPE public.sent_channel AS ENUM ('whatsapp','email','sms','instagram');
CREATE TYPE public.booking_status AS ENUM ('cheque_pending','confirmed','cancelled','rescheduled','completed','disputed');
CREATE TYPE public.payment_type AS ENUM ('full','advance_50','instalment','cash','cheque','b2b_credit');
CREATE TYPE public.payment_status AS ENUM ('pending','received','bounced','disputed','refunded');

-- Extend companies with new settings
ALTER TABLE public.companies
  ADD COLUMN services_catalog jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN staff_max_discount_percent numeric NOT NULL DEFAULT 5,
  ADD COLUMN admin_max_discount_percent numeric NOT NULL DEFAULT 15,
  ADD COLUMN require_discount_reason boolean NOT NULL DEFAULT true,
  ADD COLUMN gst_percent numeric NOT NULL DEFAULT 18,
  ADD COLUMN refund_over_30_percent numeric NOT NULL DEFAULT 100,
  ADD COLUMN refund_15_30_percent numeric NOT NULL DEFAULT 50,
  ADD COLUMN refund_under_15_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN auto_notify_competing_leads boolean NOT NULL DEFAULT false,
  ADD COLUMN auto_wa_on_reschedule boolean NOT NULL DEFAULT true,
  ADD COLUMN auto_sms_fallback boolean NOT NULL DEFAULT false,
  ADD COLUMN wa_template_payment_reminder text,
  ADD COLUMN wa_template_thank_you text,
  ADD COLUMN wa_template_reschedule text,
  ADD COLUMN wa_template_competing_leads text,
  ADD COLUMN quotation_prefix text NOT NULL DEFAULT 'QT',
  ADD COLUMN quotation_counter integer NOT NULL DEFAULT 0;

-- Quotations
CREATE TABLE public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  requirement_id uuid NOT NULL,
  company_id uuid NOT NULL,
  quotation_number text,
  version integer NOT NULL DEFAULT 1,
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  addons jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  discount_reason text,
  gst_applied boolean NOT NULL DEFAULT true,
  gst_percent numeric NOT NULL DEFAULT 18,
  gst_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  is_peak_season boolean NOT NULL DEFAULT false,
  peak_season_label text,
  status public.quotation_status NOT NULL DEFAULT 'draft',
  sent_via public.sent_channel,
  sent_at timestamptz,
  agreed_at timestamptz,
  pdf_url text,
  created_by uuid,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO authenticated;
GRANT ALL ON public.quotations TO service_role;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin quotations" ON public.quotations FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "company view quotations" ON public.quotations FOR SELECT TO authenticated
  USING (company_id = private.current_company_id());
CREATE POLICY "company insert quotations" ON public.quotations FOR INSERT TO authenticated
  WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "company update quotations" ON public.quotations FOR UPDATE TO authenticated
  USING (company_id = private.current_company_id())
  WITH CHECK (company_id = private.current_company_id());
CREATE INDEX idx_quotations_lead ON public.quotations(lead_id);
CREATE INDEX idx_quotations_company ON public.quotations(company_id);
CREATE TRIGGER trg_quotations_updated BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Bookings
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  requirement_id uuid NOT NULL,
  quotation_id uuid,
  company_id uuid NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'confirmed',
  event_date date NOT NULL,
  start_time time,
  end_time time,
  venue text,
  total_amount numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  balance_due numeric NOT NULL DEFAULT 0,
  payment_type public.payment_type,
  cheque_number text,
  cheque_bank text,
  cheque_clear_date date,
  cheque_cleared_at timestamptz,
  cheque_cleared_by uuid,
  cancelled_at timestamptz,
  cancellation_reason text,
  refund_percent numeric,
  refund_amount numeric,
  refund_reference text,
  refund_processed_at timestamptz,
  refund_processed_by uuid,
  refund_status text,
  rescheduled_from_date date,
  rescheduled_from_start_time time,
  dispute_reason text,
  disputed_at timestamptz,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin bookings" ON public.bookings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "company view bookings" ON public.bookings FOR SELECT TO authenticated
  USING (company_id = private.current_company_id());
CREATE POLICY "company insert bookings" ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "company update bookings" ON public.bookings FOR UPDATE TO authenticated
  USING (company_id = private.current_company_id())
  WITH CHECK (company_id = private.current_company_id());
CREATE INDEX idx_bookings_lead ON public.bookings(lead_id);
CREATE INDEX idx_bookings_company ON public.bookings(company_id);
CREATE INDEX idx_bookings_event_date ON public.bookings(event_date);
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Payments
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  company_id uuid NOT NULL,
  type public.payment_type NOT NULL,
  amount numeric NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  due_date date,
  received_at timestamptz,
  cheque_number text,
  cheque_bank text,
  cheque_clear_date date,
  transaction_reference text,
  instalment_number integer,
  total_instalments integer,
  dispute_reason text,
  notes text,
  created_by uuid,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin payments" ON public.payments FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "company view payments" ON public.payments FOR SELECT TO authenticated
  USING (company_id = private.current_company_id());
CREATE POLICY "company insert payments" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "company update payments" ON public.payments FOR UPDATE TO authenticated
  USING (company_id = private.current_company_id())
  WITH CHECK (company_id = private.current_company_id());
CREATE INDEX idx_payments_booking ON public.payments(booking_id);
CREATE INDEX idx_payments_lead ON public.payments(lead_id);

-- Payment reminders
CREATE TABLE public.payment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid,
  booking_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  company_id uuid NOT NULL,
  scheduled_at timestamptz NOT NULL,
  trigger_percent integer,
  message_template text,
  is_sent boolean NOT NULL DEFAULT false,
  is_cancelled boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_reminders TO authenticated;
GRANT ALL ON public.payment_reminders TO service_role;
ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin payment_reminders" ON public.payment_reminders FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "company view payment_reminders" ON public.payment_reminders FOR SELECT TO authenticated
  USING (company_id = private.current_company_id());
CREATE POLICY "company insert payment_reminders" ON public.payment_reminders FOR INSERT TO authenticated
  WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "company update payment_reminders" ON public.payment_reminders FOR UPDATE TO authenticated
  USING (company_id = private.current_company_id())
  WITH CHECK (company_id = private.current_company_id());
CREATE INDEX idx_payment_reminders_booking ON public.payment_reminders(booking_id);
CREATE INDEX idx_payment_reminders_scheduled ON public.payment_reminders(scheduled_at) WHERE is_sent = false AND is_cancelled = false;
