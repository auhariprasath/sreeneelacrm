-- Add quotation valid-days field to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS quotation_valid_days integer NOT NULL DEFAULT 7;