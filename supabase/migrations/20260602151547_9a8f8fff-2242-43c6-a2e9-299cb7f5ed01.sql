
CREATE TYPE public.task_reply_type AS ENUM ('noted','started','completed','comment');

CREATE TABLE public.task_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  company_id uuid NOT NULL,
  reply_type public.task_reply_type NOT NULL,
  message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_replies_task ON public.task_replies(task_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_replies TO authenticated;
GRANT ALL ON public.task_replies TO service_role;

ALTER TABLE public.task_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company view task_replies" ON public.task_replies
  FOR SELECT TO authenticated
  USING (company_id = private.current_company_id());

CREATE POLICY "company insert task_replies" ON public.task_replies
  FOR INSERT TO authenticated
  WITH CHECK (company_id = private.current_company_id());

CREATE POLICY "super admin task_replies" ON public.task_replies
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role));
