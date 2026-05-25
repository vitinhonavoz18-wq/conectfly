-- 1. Revoke SELECT on the sensitive column from everyone public
REVOKE SELECT ON public.restaurants FROM anon, authenticated;

-- Grant select on safe columns to anon and authenticated
GRANT SELECT (
    id, slug, custom_subdomain, name, tagline, description, 
    whatsapp_number, whatsapp_display, whatsapp_enabled, 
    address, hours, city, logo_url, hero_image_url, 
    hero_media_type, hero_video_url, primary_color, 
    secondary_color, published, show_item_images, 
    flycontrol_enabled, flycontrol_base_url, flycontrol_api_url, 
    selected_template, created_at, updated_at, owner_id
) ON public.restaurants TO anon, authenticated;

-- 2. Fix SECURITY DEFINER functions with search_path and permissions
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
    SELECT owner_id, flycontrol_api_key INTO v_owner_id, v_key
    FROM public.restaurants
    WHERE id = p_restaurant_id;

    IF (auth.uid() = v_owner_id) OR (auth.uid() = 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3') THEN
        RETURN v_key;
    ELSE
        RETURN NULL;
    END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_restaurant_flycontrol_key(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_restaurant_flycontrol_key(uuid) TO authenticated;

-- Ensure other functions are secure
ALTER FUNCTION public.is_admin() SET search_path = public, extensions;
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public, extensions;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, extensions;

-- 3. Recreate the public view to ensure it follows the new permissions
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
