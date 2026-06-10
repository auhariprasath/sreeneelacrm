-- 1. Create venue-photos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'venue-photos',
  'venue-photos',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for venue-photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'venue_photos_insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY venue_photos_insert ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'venue-photos')
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'venue_photos_select'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY venue_photos_select ON storage.objects
        FOR SELECT TO authenticated
        USING (bucket_id = 'venue-photos')
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'venue_photos_delete'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY venue_photos_delete ON storage.objects
        FOR DELETE TO authenticated
        USING (bucket_id = 'venue-photos')
    $policy$;
  END IF;
END;
$$;

-- 2. Add follow_up and venue_meeting to lead_status enum
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'follow_up';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'venue_meeting';

-- 3. Emoji template fix moved to migration 20260610000005_fix_emoji_template.sql
SELECT 1;
