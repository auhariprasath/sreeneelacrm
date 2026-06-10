
-- Event coordination tables
CREATE TYPE public.coordination_stage AS ENUM (
  'coordinator_assigned',
  'requirements_reviewed',
  'preparations_started',
  'venue_ready',
  'event_started',
  'event_completed'
);

CREATE TABLE public.event_coordination (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  coordinator_id uuid NOT NULL,
  coordinator_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  client_status_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_coordination_booking ON public.event_coordination(booking_id);
CREATE INDEX idx_event_coordination_company ON public.event_coordination(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_coordination TO authenticated;
GRANT ALL ON public.event_coordination TO service_role;

ALTER TABLE public.event_coordination ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company view event coordination" ON public.event_coordination
  FOR SELECT TO authenticated USING (company_id = private.current_company_id());
CREATE POLICY "company insert event coordination" ON public.event_coordination
  FOR INSERT TO authenticated WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "company update event coordination" ON public.event_coordination
  FOR UPDATE TO authenticated USING (company_id = private.current_company_id())
  WITH CHECK (company_id = private.current_company_id());
CREATE POLICY "company delete event coordination" ON public.event_coordination
  FOR DELETE TO authenticated USING (company_id = private.current_company_id());

CREATE TRIGGER trg_event_coordination_updated BEFORE UPDATE ON public.event_coordination
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.event_coordination_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordination_id uuid NOT NULL REFERENCES public.event_coordination(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL,
  company_id uuid NOT NULL,
  stage public.coordination_stage NOT NULL,
  updated_by uuid,
  updated_via text NOT NULL DEFAULT 'tap_link',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coordination_id, stage)
);

CREATE INDEX idx_coord_updates_coord ON public.event_coordination_updates(coordination_id);

GRANT SELECT, INSERT ON public.event_coordination_updates TO authenticated;
GRANT ALL ON public.event_coordination_updates TO service_role;

ALTER TABLE public.event_coordination_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company view coord updates" ON public.event_coordination_updates
  FOR SELECT TO authenticated USING (company_id = private.current_company_id());
CREATE POLICY "company insert coord updates" ON public.event_coordination_updates
  FOR INSERT TO authenticated WITH CHECK (company_id = private.current_company_id());

ALTER PUBLICATION supabase_realtime ADD TABLE public.event_coordination;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_coordination_updates;
