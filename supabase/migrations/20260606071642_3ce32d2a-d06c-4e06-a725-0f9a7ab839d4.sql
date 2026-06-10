
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS public_token text UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  ADD COLUMN IF NOT EXISTS proof_url text,
  ADD COLUMN IF NOT EXISTS proof_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS proof_payer_name text,
  ADD COLUMN IF NOT EXISTS proof_note text;

UPDATE public.payments SET public_token = replace(gen_random_uuid()::text, '-', '') WHERE public_token IS NULL;

-- Allow anonymous read by public_token so client can confirm payment context
DROP POLICY IF EXISTS "Public can read payment by token" ON public.payments;
CREATE POLICY "Public can read payment by token"
ON public.payments FOR SELECT TO anon
USING (public_token IS NOT NULL);

GRANT SELECT ON public.payments TO anon;
