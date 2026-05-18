-- Re-create the view explicitly as security invoker (default in Postgres 15+, but good to be explicit)
DROP VIEW IF EXISTS public.pizzerias_public;
CREATE OR REPLACE VIEW public.pizzerias_public 
WITH (security_invoker = on)
AS
SELECT 
    id, 
    slug, 
    name, 
    tagline, 
    description, 
    whatsapp_number, 
    whatsapp_display, 
    address, 
    hours, 
    city, 
    logo_url, 
    hero_image_url, 
    primary_color, 
    secondary_color, 
    published
FROM public.restaurants;

-- Re-grant access
GRANT SELECT ON public.pizzerias_public TO anon, authenticated;
