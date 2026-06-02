
CREATE TABLE IF NOT EXISTS public.task_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  company_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('absolute','before_event','before_due')),
  absolute_at timestamptz,
  offset_value integer,
  offset_unit text CHECK (offset_unit IS NULL OR offset_unit IN ('hours','days')),
  repeat boolean NOT NULL DEFAULT false,
  repeat_frequency text CHECK (repeat_frequency IS NULL OR repeat_frequency IN ('hourly','daily','every_2_days','custom')),
  repeat_interval_hours integer,
  notify_assignee boolean NOT NULL DEFAULT true,
  notify_admin boolean NOT NULL DEFAULT true,
  send_wa boolean NOT NULL DEFAULT false,
  scheduled_at timestamptz NOT NULL,
  next_fire_at timestamptz,
  last_fired_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  cancelled_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_reminders_task ON public.task_reminders(task_id);
CREATE INDEX IF NOT EXISTS idx_task_reminders_next_fire ON public.task_reminders(next_fire_at) WHERE is_active = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_reminders TO authenticated;
GRANT ALL ON public.task_reminders TO service_role;

ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company view task_reminders"
  ON public.task_reminders FOR SELECT TO authenticated
  USING (company_id = private.current_company_id());

CREATE POLICY "company insert task_reminders"
  ON public.task_reminders FOR INSERT TO authenticated
  WITH CHECK (company_id = private.current_company_id());

CREATE POLICY "company update task_reminders"
  ON public.task_reminders FOR UPDATE TO authenticated
  USING (company_id = private.current_company_id())
  WITH CHECK (company_id = private.current_company_id());

CREATE POLICY "company delete task_reminders"
  ON public.task_reminders FOR DELETE TO authenticated
  USING (company_id = private.current_company_id());

CREATE POLICY "super admin task_reminders"
  ON public.task_reminders FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_task_reminders_updated_at
  BEFORE UPDATE ON public.task_reminders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
