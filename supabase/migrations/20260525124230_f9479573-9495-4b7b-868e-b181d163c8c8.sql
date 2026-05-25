-- 1. Hardening restaurants table RLS
DROP POLICY IF EXISTS "Public Select" ON public.restaurants;
DROP POLICY IF EXISTS "Admin All" ON public.restaurants;

-- Policy for owners to see and manage their own restaurants
CREATE POLICY "Owners can manage their own restaurants"
ON public.restaurants
FOR ALL
TO authenticated
USING (auth.uid() = owner_id OR (SELECT (id = 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3') FROM auth.users WHERE id = auth.uid()))
WITH CHECK (auth.uid() = owner_id OR (SELECT (id = 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3') FROM auth.users WHERE id = auth.uid()));

-- Policy for public to see published restaurants (non-sensitive columns only via GRANT)
CREATE POLICY "Public can view published restaurants"
ON public.restaurants
FOR SELECT
TO anon, authenticated
USING (published = true);

-- 2. Restrict column-level access for anonymous users
REVOKE SELECT ON public.restaurants FROM anon;
GRANT SELECT (
    id, slug, custom_subdomain, name, tagline, description, 
    whatsapp_number, whatsapp_display, whatsapp_enabled, 
    address, hours, city, logo_url, hero_image_url, 
    hero_media_type, hero_video_url, primary_color, 
    secondary_color, published, show_item_images, 
    flycontrol_enabled, flycontrol_base_url, flycontrol_api_url, 
    selected_template
) ON public.restaurants TO anon;

-- 3. Secure get_restaurant_flycontrol_key function
CREATE OR REPLACE FUNCTION public.get_restaurant_flycontrol_key(p_restaurant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions
 AS $function$
DECLARE
    v_key TEXT;
    v_owner_id UUID;
BEGIN
    -- Get the owner_id and key
    SELECT owner_id, flycontrol_api_key INTO v_owner_id, v_key
    FROM public.restaurants
    WHERE id = p_restaurant_id;

    -- Check if the current user is the owner or the specific admin
    IF (auth.uid() = v_owner_id) OR (auth.uid() = 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3') THEN
        RETURN v_key;
    ELSE
        RETURN NULL;
    END IF;
END;
$function$;

-- Revoke execute from public
REVOKE EXECUTE ON FUNCTION public.get_restaurant_flycontrol_key(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_restaurant_flycontrol_key(uuid) TO authenticated;

-- 4. Fix search_path and security for other functions
ALTER FUNCTION public.is_admin() SET search_path = public, extensions;
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public, extensions;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, extensions;

-- 5. Ensure all other tables have strict RLS (already enabled, just making sure no anon writes exist)
-- Most tables already have "Admin All" which uses is_admin() and is restricted to authenticated users.
-- "Public Select" policies are fine as they are read-only and use EXISTS(restaurants) check.

-- 6. Address the pizzerias_public view
-- If it was created without SECURITY DEFINER, it's already SECURITY INVOKER.
-- Since it selects from restaurants, and anon now has column-level SELECT on restaurants, 
-- and RLS allows them to see published rows, the view will work securely.
-- But we'll recreate it just to be sure it's fresh with the new permissions.
DROP VIEW IF EXISTS public.pizzerias_public;
CREATE VIEW public.pizzerias_public AS
SELECT 
    id, slug, custom_subdomain, name, tagline, description, 
    whatsapp_number, whatsapp_display, whatsapp_enabled, 
    address, hours, city, logo_url, hero_image_url, 
    hero_media_type, hero_video_url, primary_color, 
    secondary_color, published, show_item_images, 
    flycontrol_enabled, flycontrol_base_url, flycontrol_api_url, 
    selected_template
FROM public.restaurants 
WHERE published = true;

GRANT SELECT ON public.pizzerias_public TO anon, authenticated;
