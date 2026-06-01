
DROP POLICY IF EXISTS "public insert feedback" ON public.feedback;

CREATE POLICY "public insert feedback for real booking" ON public.feedback
FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = feedback.booking_id
      AND b.lead_id = feedback.lead_id
      AND b.company_id = feedback.company_id
      AND b.deleted_at IS NULL
  )
);
