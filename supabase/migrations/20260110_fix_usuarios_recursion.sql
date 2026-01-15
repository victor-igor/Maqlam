-- Fix infinite recursion in usuarios table policies
-- The "Admin All" policy was querying the usuarios table directly, causing recursion.
-- Solution: Use a SECURITY DEFINER function to bypass RLS for the admin check.

-- 1. Create the helper function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuarios
    WHERE auth_id = auth.uid()
    AND role = 'admin'
  );
$$;

-- 2. Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- 3. Drop the old recursive policy
DROP POLICY IF EXISTS "Admin All" ON usuarios;

-- 4. Create the new safe policy
CREATE POLICY "Admin All" ON usuarios
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());
