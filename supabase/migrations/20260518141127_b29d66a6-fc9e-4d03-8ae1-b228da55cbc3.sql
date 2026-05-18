-- Remover e recriar a view para evitar erros de ordem de colunas
DROP VIEW IF EXISTS public.pizzerias_public;

CREATE VIEW public.pizzerias_public AS
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
    flycontrol_api_url,
    CASE 
        WHEN flycontrol_api_key IS NOT NULL THEN '********' 
        ELSE NULL 
    END as flycontrol_api_key_masked
FROM public.restaurants;

-- Garantir permissões novamente
GRANT SELECT ON public.pizzerias_public TO anon, authenticated;
