-- 1. Secure all SECURITY DEFINER functions
-- Set search_path and revoke public execute for all

-- is_admin
ALTER FUNCTION public.is_admin() SET search_path = public, extensions;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- has_role
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public, extensions;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- owns_restaurant
ALTER FUNCTION public.owns_restaurant(uuid, uuid) SET search_path = public, extensions;
REVOKE EXECUTE ON FUNCTION public.owns_restaurant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_restaurant(uuid, uuid) TO authenticated;

-- check_order_rate_limit
ALTER FUNCTION public.check_order_rate_limit(uuid, text) SET search_path = public, extensions;
REVOKE EXECUTE ON FUNCTION public.check_order_rate_limit(uuid, text) FROM PUBLIC;
-- This one might need to be callable by anon if orders are public, 
-- but it's called by the server function (submit-order.ts) using supabaseAdmin.
-- So revoking from PUBLIC is safe as supabaseAdmin bypasses RLS and permissions.

-- handle_new_user_role
ALTER FUNCTION public.handle_new_user_role() SET search_path = public, extensions;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC;
-- This is likely a trigger function, so it only needs to be callable by the system.

-- get_restaurant_flycontrol_key (already secured, but being thorough)
ALTER FUNCTION public.get_restaurant_flycontrol_key(uuid) SET search_path = public, extensions;
REVOKE EXECUTE ON FUNCTION public.get_restaurant_flycontrol_key(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_restaurant_flycontrol_key(uuid) TO authenticated;
