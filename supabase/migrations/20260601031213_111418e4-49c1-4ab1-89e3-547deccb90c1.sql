CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION private.current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM public.profiles
  WHERE id = auth.uid()
$$;

GRANT USAGE ON SCHEMA private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_company_id() TO authenticated, service_role;

DROP POLICY IF EXISTS "admin update own company" ON public.companies;
DROP POLICY IF EXISTS "super admin all companies" ON public.companies;
DROP POLICY IF EXISTS "view own company" ON public.companies;

CREATE POLICY "super admin all companies"
ON public.companies
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "view own company"
ON public.companies
FOR SELECT
TO authenticated
USING (id = private.current_company_id());

CREATE POLICY "admin update own company"
ON public.companies
FOR UPDATE
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role) AND id = private.current_company_id());

DROP POLICY IF EXISTS "admin manage company profiles" ON public.profiles;
DROP POLICY IF EXISTS "admin view company profiles" ON public.profiles;
DROP POLICY IF EXISTS "super admin manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "super admin view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "update own profile" ON public.profiles;
DROP POLICY IF EXISTS "view own profile" ON public.profiles;

CREATE POLICY "view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid());

CREATE POLICY "super admin view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "super admin manage profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "admin view company profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role) AND company_id = private.current_company_id());

CREATE POLICY "admin manage company profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role) AND company_id = private.current_company_id())
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) AND company_id = private.current_company_id());

DROP POLICY IF EXISTS "super admin manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "super admin view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "view own roles" ON public.user_roles;

CREATE POLICY "view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "super admin view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "super admin manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));