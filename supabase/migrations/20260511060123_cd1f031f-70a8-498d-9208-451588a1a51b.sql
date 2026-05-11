-- Revoke execute from anon/public on security definer functions; grant only to authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.owns_restaurant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_restaurant(uuid, uuid) TO authenticated;

-- Restrict logos bucket SELECT to specific files (no listing)
DROP POLICY IF EXISTS "logos public read" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- Allow public access to read individual files but no listing
CREATE POLICY "logos public read individual" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'logos');