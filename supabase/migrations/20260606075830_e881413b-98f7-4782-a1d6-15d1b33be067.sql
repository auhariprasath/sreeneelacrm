ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_vendors;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback;
ALTER TABLE public.booking_vendors REPLICA IDENTITY FULL;
ALTER TABLE public.feedback REPLICA IDENTITY FULL;