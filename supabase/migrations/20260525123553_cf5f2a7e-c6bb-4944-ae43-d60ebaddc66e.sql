-- Add selected_template column to restaurants
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS selected_template TEXT NOT NULL DEFAULT 'black';

-- Drop and recreate the view to include the new column
DROP VIEW IF EXISTS public.pizzerias_public;

CREATE VIEW public.pizzerias_public AS
SELECT 
    id, 
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
