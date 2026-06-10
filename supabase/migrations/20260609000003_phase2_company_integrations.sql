ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS integrations jsonb NOT NULL DEFAULT '[]'::jsonb;
