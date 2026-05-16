
-- 1) Remove broad public-read policies on restaurants (sensitive columns leak)
DROP POLICY IF EXISTS "public read restaurants" ON public.restaurants;

-- 2) order_logs: add owner-scoped read; inserts/updates/deletes remain service-role only
CREATE POLICY "Owners can view their restaurant order logs"
ON public.order_logs
FOR SELECT
TO authenticated
USING (
  restaurant_id IS NOT NULL
  AND public.owns_restaurant(auth.uid(), restaurant_id)
);

CREATE POLICY "Admins can view all order logs"
ON public.order_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Restrict SECURITY DEFINER rate-limit function to server (service_role) only
REVOKE ALL ON FUNCTION public.check_order_rate_limit(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_order_rate_limit(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.check_order_rate_limit(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_order_rate_limit(uuid, text) TO service_role;
