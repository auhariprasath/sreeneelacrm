
-- 1) Prevent profile field escalation on self-update
CREATE OR REPLACE FUNCTION private.prevent_profile_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Super admins and same-company admins can change anything
  IF private.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF private.has_role(auth.uid(), 'admin'::app_role)
     AND OLD.company_id IS NOT NULL
     AND OLD.company_id = private.current_company_id() THEN
    RETURN NEW;
  END IF;

  -- Self-update: force sensitive fields to keep their existing values
  IF auth.uid() = OLD.id THEN
    NEW.company_id := OLD.company_id;
    NEW.is_active := OLD.is_active;
    NEW.on_leave := OLD.on_leave;
    NEW.backup_staff_id := OLD.backup_staff_id;
    NEW.must_change_password := OLD.must_change_password;
    NEW.phone_masked := OLD.phone_masked;
    NEW.auto_approve_transfers := OLD.auto_approve_transfers;
    NEW.deleted_at := OLD.deleted_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_escalation ON public.profiles;
CREATE TRIGGER prevent_profile_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.prevent_profile_escalation();

-- 2) Tighten venue-photos SELECT to the user's company (paths are "{companyId}/...")
DROP POLICY IF EXISTS "venue-photos read authenticated" ON storage.objects;
CREATE POLICY "venue-photos read own company"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'venue-photos'
    AND (
      private.has_role(auth.uid(), 'super_admin'::app_role)
      OR split_part(name, '/', 1) = private.current_company_id()::text
    )
  );

-- 3) Remove duplicate public helpers; policies already reference private.*
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_company_id() FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);
DROP FUNCTION IF EXISTS public.current_company_id();

-- 4) Allow receiving-company admins to update transfer_requests addressed to them
DROP POLICY IF EXISTS "to company admins update transfer" ON public.transfer_requests;
CREATE POLICY "to company admins update transfer"
  ON public.transfer_requests
  FOR UPDATE
  TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::app_role)
    AND to_company_id = private.current_company_id()
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::app_role)
    AND to_company_id = private.current_company_id()
  );
