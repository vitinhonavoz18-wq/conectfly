-- 1. Fix SECURITY DEFINER function execute permission
-- We only want the system (service_role) or specifically authorized callers to use this.
-- If it's used by Edge Functions, they typically use service_role.
REVOKE EXECUTE ON FUNCTION public.check_order_rate_limit(UUID, TEXT) FROM public;
REVOKE EXECUTE ON FUNCTION public.check_order_rate_limit(UUID, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_order_rate_limit(UUID, TEXT) FROM anon;

-- 2. Fix View security by making it use SECURITY INVOKER (default) and explicit search_path
-- Views in Supabase are usually better as SECURITY INVOKER.
CREATE OR REPLACE VIEW public.pizzerias_public WITH (security_invoker = true) AS
SELECT 
    id, slug, name, tagline, description, whatsapp_number, whatsapp_display, 
    address, hours, city, logo_url, hero_image_url, primary_color, 
    secondary_color, published, hero_media_type, hero_video_url, 
    flycontrol_enabled, flycontrol_api_url, flycontrol_base_url,
    CASE 
        WHEN flycontrol_api_key IS NOT NULL THEN 
            left(flycontrol_api_key, 8) || '************' || right(flycontrol_api_key, 4)
        ELSE NULL 
    END as flycontrol_api_key_masked,
    whatsapp_enabled, show_item_images
FROM public.restaurants
WHERE published = true;

-- 3. Fix handle_new_user_role permissions
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon;

-- 4. Re-grant only what is absolutely necessary for the frontend
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_restaurant(uuid, uuid) TO authenticated;
