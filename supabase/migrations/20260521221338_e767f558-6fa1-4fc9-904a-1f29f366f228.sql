-- Re-create the view with SECURITY INVOKER (PostgreSQL default for views, but explicit is better)
-- Actually, in Supabase, simple views are security invoker by default.
-- The error might be because of how it was created or if it was complex.
-- Let's drop and recreate it explicitly.

DROP VIEW IF EXISTS public.pizzerias_public;
CREATE OR REPLACE VIEW public.pizzerias_public WITH (security_invoker = on) AS
SELECT 
    id,
    slug,
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
    flycontrol_api_url
FROM public.restaurants
WHERE published = true;
