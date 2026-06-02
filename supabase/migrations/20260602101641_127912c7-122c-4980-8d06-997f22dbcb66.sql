
CREATE POLICY "venue-photos read authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'venue-photos');
CREATE POLICY "venue-photos insert admin" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'venue-photos' AND (
      private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin')
    )
  );
CREATE POLICY "venue-photos delete admin" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'venue-photos' AND (
      private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin')
    )
  );
CREATE POLICY "venue-photos update admin" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'venue-photos' AND (
      private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin')
    )
  );
