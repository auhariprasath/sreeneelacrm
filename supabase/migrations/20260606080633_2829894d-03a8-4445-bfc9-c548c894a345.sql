ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS wa_templates jsonb NOT NULL DEFAULT '{}'::jsonb;