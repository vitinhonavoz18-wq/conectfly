-- Add custom_subdomain column
ALTER TABLE public.restaurants ADD COLUMN custom_subdomain TEXT;

-- Add a unique index for custom_subdomain (allowing nulls)
CREATE UNIQUE INDEX idx_restaurants_custom_subdomain ON public.restaurants(custom_subdomain) WHERE custom_subdomain IS NOT NULL;

-- Update the public view to include the new column
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
    flycontrol_api_url
   FROM public.restaurants
  WHERE (published = true);
