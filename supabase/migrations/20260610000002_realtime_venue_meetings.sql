-- Enable realtime for venue_meetings so the dashboard sidebar and venue meetings
-- page update immediately when a meeting is scheduled or changed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'venue_meetings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.venue_meetings;
  END IF;
END $$;
