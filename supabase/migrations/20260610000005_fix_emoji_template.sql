-- Fix corrupted emoji in meeting_confirmed WhatsApp template
-- Uses jsonb_set on the top-level key to avoid path-in-scalar errors
UPDATE public.companies
SET wa_templates = jsonb_set(
  COALESCE(wa_templates, '{}'),
  '{meeting_confirmed}',
  jsonb_build_object(
    'body',
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
    'Please confirm your visit by replying *YES* or call us if you need to reschedule.',
    'autoSend', COALESCE(wa_templates->'meeting_confirmed'->'autoSend', 'false'::jsonb)
  )
)
WHERE wa_templates IS NOT NULL
  AND jsonb_typeof(wa_templates) = 'object';
