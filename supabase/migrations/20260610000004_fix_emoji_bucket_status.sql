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

-- 3. Fix corrupted emoji in meeting_confirmed WhatsApp template for all companies
UPDATE public.companies
SET wa_templates = jsonb_set(
  COALESCE(wa_templates, '{}'),
  '{meeting_confirmed,body}',
  to_jsonb(
    'Hello [Name]! 🙏' || E'\n\n' ||
    'Thank you for your interest in *[Company]*.' || E'\n' ||
    'We are pleased to invite you for a venue visit.' || E'\n\n' ||
    '*Visit Details*' || E'\n' ||
    '📅 Date: [Meeting date]' || E'\n' ||
    '⏰ Time: [Meeting time]' || E'\n' ||
    '⏳ Duration: ~[Duration] min' || E'\n\n' ||
    '*Venue*' || E'\n' ||
    '🏛 [Company]' || E'\n' ||
    '📍 [Address]' || E'\n' ||
    '🗺 Directions: [Maps link]' || E'\n\n' ||
    '*Your Point of Contact*' || E'\n' ||
    '👤 [Contact person]' || E'\n' ||
    '📞 [Contact phone]' || E'\n\n' ||
    'We look forward to welcoming you.' || E'\n' ||
    'Please confirm your visit by replying *YES* or call us if you need to reschedule.'
  )
)
WHERE wa_templates IS NOT NULL;
