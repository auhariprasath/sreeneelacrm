
-- 1. Move Razorpay payment credentials to a separate admin-only table
CREATE TABLE IF NOT EXISTS public.company_payment_credentials (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  razorpay_key_id text,
  razorpay_key_secret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_payment_credentials TO authenticated;
GRANT ALL ON public.company_payment_credentials TO service_role;

ALTER TABLE public.company_payment_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin view payment credentials"
ON public.company_payment_credentials FOR SELECT TO authenticated
USING (
  (private.has_role(auth.uid(), 'admin'::app_role) AND company_id = private.current_company_id())
  OR private.has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "admin upsert payment credentials"
ON public.company_payment_credentials FOR INSERT TO authenticated
WITH CHECK (
  (private.has_role(auth.uid(), 'admin'::app_role) AND company_id = private.current_company_id())
  OR private.has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "admin update payment credentials"
ON public.company_payment_credentials FOR UPDATE TO authenticated
USING (
  (private.has_role(auth.uid(), 'admin'::app_role) AND company_id = private.current_company_id())
  OR private.has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  (private.has_role(auth.uid(), 'admin'::app_role) AND company_id = private.current_company_id())
  OR private.has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "admin delete payment credentials"
ON public.company_payment_credentials FOR DELETE TO authenticated
USING (
  (private.has_role(auth.uid(), 'admin'::app_role) AND company_id = private.current_company_id())
  OR private.has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE TRIGGER touch_company_payment_credentials
BEFORE UPDATE ON public.company_payment_credentials
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Migrate existing data
INSERT INTO public.company_payment_credentials (company_id, razorpay_key_id, razorpay_key_secret)
SELECT id, razorpay_key_id, razorpay_key_secret
FROM public.companies
WHERE razorpay_key_id IS NOT NULL OR razorpay_key_secret IS NOT NULL
ON CONFLICT (company_id) DO NOTHING;

-- Remove sensitive columns from companies
ALTER TABLE public.companies DROP COLUMN IF EXISTS razorpay_key_id;
ALTER TABLE public.companies DROP COLUMN IF EXISTS razorpay_key_secret;

-- 2. Restrict feedback public read; allow only insert by anon. Add unique constraint to prevent dupes.
DROP POLICY IF EXISTS "public view feedback by booking" ON public.feedback;
CREATE UNIQUE INDEX IF NOT EXISTS feedback_booking_id_unique ON public.feedback(booking_id);

-- 3. Fix vendor_status_updates broken anon insert + open select
DROP POLICY IF EXISTS "public read vendor_status_updates" ON public.vendor_status_updates;
DROP POLICY IF EXISTS "public insert vendor_status_updates" ON public.vendor_status_updates;

CREATE POLICY "public insert vendor_status_updates via token"
ON public.vendor_status_updates FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.booking_vendors bv
    WHERE bv.id = vendor_status_updates.booking_vendor_id
      AND bv.booking_id = vendor_status_updates.booking_id
      AND bv.vendor_id = vendor_status_updates.vendor_id
      AND bv.company_id = vendor_status_updates.company_id
      AND bv.status_token IS NOT NULL
  )
);

CREATE POLICY "public read vendor_status_updates via token"
ON public.vendor_status_updates FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.booking_vendors bv
    WHERE bv.id = vendor_status_updates.booking_vendor_id
      AND bv.status_token IS NOT NULL
  )
);

-- 4. Scope referral_loyalty_flags admin policy to admin's own company
ALTER TABLE public.referral_loyalty_flags ADD COLUMN IF NOT EXISTS company_id uuid;

-- Backfill company_id from referrer lead
UPDATE public.referral_loyalty_flags rlf
SET company_id = l.company_id
FROM public.leads l
WHERE rlf.referrer_lead_id = l.id AND rlf.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_referral_loyalty_flags_company ON public.referral_loyalty_flags(company_id);

DROP POLICY IF EXISTS "admin view loyalty flags" ON public.referral_loyalty_flags;
CREATE POLICY "admin view loyalty flags"
ON public.referral_loyalty_flags FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  AND company_id = private.current_company_id()
);

-- 5. Baseline RLS on realtime.messages: require authenticated subscribers.
--    postgres_changes already enforces RLS on the underlying tables, but
--    this prevents anonymous clients from connecting to any realtime topic.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='realtime' AND tablename='messages'
      AND policyname='authenticated can receive realtime messages'
  ) THEN
    CREATE POLICY "authenticated can receive realtime messages"
    ON realtime.messages FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
