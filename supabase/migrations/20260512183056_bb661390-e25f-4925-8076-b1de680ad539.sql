
-- 1. Revoke FlyControl credential columns from anon and authenticated (only service_role/admin server access)
REVOKE SELECT (flycontrol_api_key, flycontrol_api_url, flycontrol_base_url, flycontrol_register_url, flycontrol_tenant_id)
  ON public.restaurants FROM anon, authenticated, PUBLIC;

-- 2. Tighten restaurants UPDATE policy: remove the owner_id IS NULL bypass
DROP POLICY IF EXISTS "owner update restaurants" ON public.restaurants;
CREATE POLICY "owner update restaurants"
  ON public.restaurants
  FOR UPDATE
  TO authenticated
  USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Also update owns_restaurant() helper to drop the NULL-owner fallback
CREATE OR REPLACE FUNCTION public.owns_restaurant(_user_id uuid, _restaurant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = _restaurant_id
      AND (
        owner_id = _user_id
        OR public.has_role(_user_id, 'admin')
      )
  )
$function$;

-- 3. Restrict logos bucket writes to the owner of the restaurant whose id is the first folder segment.
-- File path convention: <restaurant_id>/<filename>
DROP POLICY IF EXISTS "logos auth insert" ON storage.objects;
DROP POLICY IF EXISTS "logos auth update" ON storage.objects;
DROP POLICY IF EXISTS "logos auth delete" ON storage.objects;

CREATE POLICY "logos owner insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND public.owns_restaurant(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "logos owner update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND public.owns_restaurant(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'logos'
    AND public.owns_restaurant(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "logos owner delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND public.owns_restaurant(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
