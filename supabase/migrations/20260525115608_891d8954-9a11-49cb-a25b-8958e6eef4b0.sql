-- Fix linter warnings for is_admin()
ALTER FUNCTION public.is_admin() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon; 
-- Note: 'anon' needs it because RLS for SELECT on public tables might trigger it if called in those policies.
-- However, since it checks auth.uid(), anon will just get FALSE.
