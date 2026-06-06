
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS portfolio_url text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS include_photos_in_requirements boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_portfolio_in_day5 boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS stale_alerts_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS stale_thresholds jsonb NOT NULL DEFAULT '{"new":2,"in_progress":3,"quote_sent":7,"quote_accepted":3,"no_reply":5}'::jsonb;
