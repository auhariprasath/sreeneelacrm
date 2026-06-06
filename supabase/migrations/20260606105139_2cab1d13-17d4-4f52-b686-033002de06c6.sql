DROP POLICY IF EXISTS "Public can read payment by token" ON public.payments;
DROP POLICY IF EXISTS "public read by token" ON public.quotations;
DROP POLICY IF EXISTS "public read vendor_status_updates via token" ON public.vendor_status_updates;
DROP POLICY IF EXISTS "public insert vendor_status_updates via token" ON public.vendor_status_updates;