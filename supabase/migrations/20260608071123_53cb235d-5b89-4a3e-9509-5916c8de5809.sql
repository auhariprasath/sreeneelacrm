
-- Rename old enum, create new one with desired values, migrate data, drop old.
ALTER TYPE public.company_type RENAME TO company_type_old;

CREATE TYPE public.company_type AS ENUM ('garden_venue','banquet_hall','party_hall','mandapam','other');

ALTER TABLE public.companies
  ALTER COLUMN type DROP DEFAULT,
  ALTER COLUMN type TYPE public.company_type
  USING (
    CASE type::text
      WHEN 'garden'   THEN 'garden_venue'
      WHEN 'banquet'  THEN 'banquet_hall'
      WHEN 'party'    THEN 'party_hall'
      WHEN 'mandapam' THEN 'mandapam'
      ELSE 'other'
    END
  )::public.company_type,
  ALTER COLUMN type SET DEFAULT 'banquet_hall'::public.company_type;

DROP TYPE public.company_type_old;

-- Free-text label when 'other' is chosen
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS custom_type text;
