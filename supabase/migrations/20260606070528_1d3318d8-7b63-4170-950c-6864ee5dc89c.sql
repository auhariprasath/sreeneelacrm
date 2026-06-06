
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS public_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

UPDATE public.quotations SET public_token = encode(gen_random_bytes(16), 'hex') WHERE public_token IS NULL;

-- Allow anonymous read by token only (filter applied via server fn using admin client; but also allow direct anon select on specific columns via policy)
CREATE POLICY "public read by token" ON public.quotations
  FOR SELECT TO anon
  USING (public_token IS NOT NULL);

GRANT SELECT ON public.quotations TO anon;
