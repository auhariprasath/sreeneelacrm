ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS task_reminder_on_booking boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS task_reminder_2d boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS task_reminder_at_due boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS send_task_requirements_wa boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS task_overdue_escalation_hours integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS confirmation_reminder_lines jsonb NOT NULL DEFAULT '["Please arrive 15 minutes before your event start time."]'::jsonb,
  ADD COLUMN IF NOT EXISTS confirmation_closing_line text DEFAULT 'We look forward to making your [event_type] truly memorable.',
  ADD COLUMN IF NOT EXISTS confirmation_auto_send boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wa_template_booking_confirmed text,
  ADD COLUMN IF NOT EXISTS wa_template_task_assigned text,
  ADD COLUMN IF NOT EXISTS wa_template_task_reminder_2d text,
  ADD COLUMN IF NOT EXISTS wa_template_task_completed text;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS confirmation_sent_by uuid;
