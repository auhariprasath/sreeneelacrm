
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.requirement_status AS ENUM ('collecting','slot_checking','slot_confirmed','muhurtham_conflict','complete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.slot_status AS ENUM ('free','soft_hold','enquiry','confirmed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend lead_status with 'unresponsive' if not present
DO $$ BEGIN
  ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'unresponsive';
EXCEPTION WHEN others THEN NULL; END $$;

-- Extend lead_status with 'positive','neutral','negative' (defensive — may already exist)
DO $$ BEGIN ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'positive'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'neutral'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'negative'; EXCEPTION WHEN others THEN NULL; END $$;

-- ============ requirements ============
CREATE TABLE IF NOT EXISTS public.requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  company_id uuid NOT NULL,
  requirement_number integer NOT NULL DEFAULT 1,
  event_date date,
  start_time time,
  end_time time,
  duration_hours numeric,
  event_type text,
  event_type_other text,
  guest_count integer,
  budget_range text,
  muhurtham_time time,
  community text,
  notes text,
  status public.requirement_status NOT NULL DEFAULT 'collecting',
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requirements_lead ON public.requirements(lead_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_requirements_company_date ON public.requirements(company_id, event_date) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.requirements TO authenticated;
GRANT ALL ON public.requirements TO service_role;

ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin requirements" ON public.requirements
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "company view requirements" ON public.requirements
  FOR SELECT TO authenticated
  USING (company_id = private.current_company_id());

CREATE POLICY "company insert requirements" ON public.requirements
  FOR INSERT TO authenticated
  WITH CHECK (company_id = private.current_company_id());

CREATE POLICY "company update requirements" ON public.requirements
  FOR UPDATE TO authenticated
  USING (company_id = private.current_company_id())
  WITH CHECK (company_id = private.current_company_id());

CREATE TRIGGER touch_requirements_updated_at
BEFORE UPDATE ON public.requirements
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ add_ons_selected ============
CREATE TABLE IF NOT EXISTS public.add_ons_selected (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL,
  addon_name text NOT NULL,
  addon_price numeric NOT NULL DEFAULT 0,
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_addons_requirement ON public.add_ons_selected(requirement_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.add_ons_selected TO authenticated;
GRANT ALL ON public.add_ons_selected TO service_role;

ALTER TABLE public.add_ons_selected ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin addons" ON public.add_ons_selected
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "company view addons" ON public.add_ons_selected
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.requirements r WHERE r.id = add_ons_selected.requirement_id AND r.company_id = private.current_company_id()));

CREATE POLICY "company insert addons" ON public.add_ons_selected
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.requirements r WHERE r.id = add_ons_selected.requirement_id AND r.company_id = private.current_company_id()));

CREATE POLICY "company delete addons" ON public.add_ons_selected
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.requirements r WHERE r.id = add_ons_selected.requirement_id AND r.company_id = private.current_company_id()));

-- ============ slots ============
CREATE TABLE IF NOT EXISTS public.slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  event_date date NOT NULL,
  session_name text,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status public.slot_status NOT NULL DEFAULT 'free',
  held_by_lead_id uuid,
  held_by_requirement_id uuid,
  held_until timestamptz,
  confirmed_by_booking_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slots_company_date ON public.slots(company_id, event_date);
CREATE INDEX IF NOT EXISTS idx_slots_status ON public.slots(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slots TO authenticated;
GRANT ALL ON public.slots TO service_role;

ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin slots" ON public.slots
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "company view slots" ON public.slots
  FOR SELECT TO authenticated
  USING (company_id = private.current_company_id());

-- Authenticated users may insert/update slots for their own company (server fns will gate behavior).
CREATE POLICY "company insert slots" ON public.slots
  FOR INSERT TO authenticated
  WITH CHECK (company_id = private.current_company_id());

CREATE POLICY "company update slots" ON public.slots
  FOR UPDATE TO authenticated
  USING (company_id = private.current_company_id())
  WITH CHECK (company_id = private.current_company_id());

CREATE TRIGGER touch_slots_updated_at
BEFORE UPDATE ON public.slots
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Settings extensions on companies ============
-- Sessions, event types, and add-ons stored as JSONB on companies for simplicity
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS sessions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS event_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS addons_catalog jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS drop_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_mandapam boolean NOT NULL DEFAULT false;

-- ============ follow_ups extension (Phase 3 fields) ============
DO $$ BEGIN
  CREATE TYPE public.follow_up_type AS ENUM ('auto_1hr','tomorrow_10am','custom','done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.follow_ups
  ADD COLUMN IF NOT EXISTS type public.follow_up_type NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS is_cancelled boolean NOT NULL DEFAULT false;
