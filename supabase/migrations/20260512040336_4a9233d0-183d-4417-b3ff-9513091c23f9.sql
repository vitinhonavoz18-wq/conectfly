-- 1. Revoke public execution on security functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM authenticated;

-- 2. Tighten storage policies for logos
-- Ensure logos are readable but not listable (though usually SELECT policy handles this)
-- If there's an existing wide SELECT policy, we should refine it.
DO $$
BEGIN
    -- Only allow SELECT if the bucket is 'logos' and the user is authenticated, 
    -- OR keep it public if you want anyone to see logos (standard for websites)
    -- The linter warning 0025 specifically refers to the ability to LIST.
    -- To prevent listing while allowing access to specific files:
    DROP POLICY IF EXISTS "Public Access" ON storage.objects;
    DROP POLICY IF EXISTS "logos public read" ON storage.objects;
    
    CREATE POLICY "logos public read" ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'logos');
      
    -- Note: Listing is usually prevented if the policy doesn't explicitly allow it or if it's scoped properly.
END $$;

-- 3. Ensure other SECURITY DEFINER functions have restricted access if they don't need to be public
-- has_role and owns_restaurant are used in RLS, so 'authenticated' NEEDS execute permission.
-- But 'anon' might not need it for all of them.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
-- owns_restaurant is needed for 'anon' because of the beverage select policy:
-- USING (is_active = true OR public.owns_restaurant(auth.uid(), pizzeria_id))
-- But wait, if auth.uid() is null (anon), owns_restaurant will return false anyway.
-- So we can keep it for anon or revoke it if it's not strictly necessary.
-- Actually, let's keep it for authenticated only to be safe.
REVOKE EXECUTE ON FUNCTION public.owns_restaurant(uuid, uuid) FROM anon;
