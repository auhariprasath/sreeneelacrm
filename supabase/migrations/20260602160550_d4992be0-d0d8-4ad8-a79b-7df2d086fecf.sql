ALTER TABLE public.tasks ADD COLUMN vendor_id uuid;
CREATE INDEX idx_tasks_vendor ON public.tasks(vendor_id) WHERE vendor_id IS NOT NULL AND deleted_at IS NULL;