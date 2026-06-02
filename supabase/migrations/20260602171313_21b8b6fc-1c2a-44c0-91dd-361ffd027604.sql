ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS assigned_to uuid;
CREATE INDEX IF NOT EXISTS idx_bookings_assigned_to ON public.bookings(assigned_to);