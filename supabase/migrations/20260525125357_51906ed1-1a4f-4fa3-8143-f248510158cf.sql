-- Revogar execução pública de funções SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public;
REVOKE EXECUTE ON FUNCTION public.check_order_rate_limit(uuid, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_restaurant_flycontrol_key(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM public;
REVOKE EXECUTE ON FUNCTION public.owns_restaurant(uuid, uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM public;

-- Conceder execução apenas para authenticated ou service_role
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_order_rate_limit(uuid, text) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.get_restaurant_flycontrol_key(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_restaurant(uuid, uuid) TO authenticated, service_role;

-- Reforçar search_path
ALTER FUNCTION public.is_admin() SET search_path = public, extensions;
ALTER FUNCTION public.check_order_rate_limit(uuid, text) SET search_path = public, extensions;
ALTER FUNCTION public.get_restaurant_flycontrol_key(uuid) SET search_path = public, extensions;

-- Resolver o "Security Definer View" para pizzerias_public
DROP VIEW IF EXISTS public.pizzerias_public;
CREATE VIEW public.pizzerias_public AS
 SELECT id,
    slug,
    custom_subdomain,
    name,
    tagline,
    description,
    whatsapp_number,
    whatsapp_display,
    whatsapp_enabled,
    address,
    hours,
    city,
    logo_url,
    hero_image_url,
    hero_media_type,
    hero_video_url,
    primary_color,
    secondary_color,
    published,
    show_item_images,
    flycontrol_enabled,
    flycontrol_base_url,
    flycontrol_api_url,
    selected_template
   FROM public.restaurants
  WHERE published = true;

GRANT SELECT ON public.pizzerias_public TO anon, authenticated;
