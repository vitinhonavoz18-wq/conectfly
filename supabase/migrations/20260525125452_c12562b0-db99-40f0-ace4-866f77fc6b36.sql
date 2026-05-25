-- Revogar TUDO de anon nas funções sensíveis
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.check_order_rate_limit(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_restaurant_flycontrol_key(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.owns_restaurant(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon, public;

-- Conceder apenas para service_role (e authenticated se necessário por lógica de UI)
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_restaurant_flycontrol_key(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_order_rate_limit(uuid, text) TO service_role; -- Apenas o backend usa
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_restaurant(uuid, uuid) TO authenticated, service_role;
