
-- 1. customers: switch to private.* helpers
DROP POLICY IF EXISTS "company view customers" ON public.customers;
DROP POLICY IF EXISTS "company insert customers" ON public.customers;
DROP POLICY IF EXISTS "company update customers" ON public.customers;
DROP POLICY IF EXISTS "company delete customers" ON public.customers;

CREATE POLICY "company view customers" ON public.customers FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::app_role) OR (company_id = private.current_company_id()));
CREATE POLICY "company insert customers" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'::app_role) OR (company_id = private.current_company_id()));
CREATE POLICY "company update customers" ON public.customers FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::app_role) OR (company_id = private.current_company_id()));
CREATE POLICY "company delete customers" ON public.customers FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::app_role) OR (company_id = private.current_company_id()));

-- 2. feedback: drop the anon insert policy; server fn with service role handles inserts
DROP POLICY IF EXISTS "public insert feedback for real booking" ON public.feedback;

-- 3. payment-proofs storage policies
DROP POLICY IF EXISTS "Anyone can upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read payment proofs" ON storage.objects;

-- Authenticated reads scoped to the user's company via payments.public_token prefix in the object name.
CREATE POLICY "Company members can read payment proofs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (
    private.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.public_token = split_part(storage.objects.name, '/', 1)
        AND p.company_id = private.current_company_id()
    )
  )
);
