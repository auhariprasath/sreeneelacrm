
-- 1) Payment-proofs: add explicit INSERT/UPDATE/DELETE policies (super_admin only; uploads go through service_role server fn)
DROP POLICY IF EXISTS "payment-proofs insert super_admin" ON storage.objects;
DROP POLICY IF EXISTS "payment-proofs update super_admin" ON storage.objects;
DROP POLICY IF EXISTS "payment-proofs delete super_admin" ON storage.objects;

CREATE POLICY "payment-proofs insert super_admin"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-proofs' AND private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "payment-proofs update super_admin"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'payment-proofs' AND private.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (bucket_id = 'payment-proofs' AND private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "payment-proofs delete super_admin"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'payment-proofs' AND private.has_role(auth.uid(), 'super_admin'::app_role));

-- 2) referral_loyalty_flags: add admin INSERT/UPDATE/DELETE scoped to company
DROP POLICY IF EXISTS "admin insert loyalty flags" ON public.referral_loyalty_flags;
DROP POLICY IF EXISTS "admin update loyalty flags" ON public.referral_loyalty_flags;
DROP POLICY IF EXISTS "admin delete loyalty flags" ON public.referral_loyalty_flags;

CREATE POLICY "admin insert loyalty flags"
ON public.referral_loyalty_flags FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) AND company_id = private.current_company_id());

CREATE POLICY "admin update loyalty flags"
ON public.referral_loyalty_flags FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role) AND company_id = private.current_company_id())
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) AND company_id = private.current_company_id());

CREATE POLICY "admin delete loyalty flags"
ON public.referral_loyalty_flags FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role) AND company_id = private.current_company_id());

-- 3) Realtime broadcast/presence: deny by default. App only uses postgres_changes which is governed by table RLS, not realtime.messages.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT polname FROM pg_policy WHERE polrelid = 'realtime.messages'::regclass LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON realtime.messages', pol.polname);
  END LOOP;
END $$;

CREATE POLICY "service role only - broadcast/presence disabled"
ON realtime.messages FOR ALL TO authenticated
USING (false) WITH CHECK (false);
