-- Adiciona colunas para controle de fluxo e webhooks na tabela restaurants
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS order_flow_mode TEXT DEFAULT 'whatsapp',
ADD COLUMN IF NOT EXISTS fiqon_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS continue_opening_whatsapp BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS allow_dual_send BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS flycontrol_direct_url TEXT,
ADD COLUMN IF NOT EXISTS menu_sync_endpoint TEXT;

-- Remove a view para recriá-la com as novas colunas
DROP VIEW IF EXISTS public.pizzerias_public;

-- Recria a view pública
CREATE VIEW public.pizzerias_public AS
SELECT 
    id, slug, name, tagline, description, whatsapp_number, whatsapp_display, 
    address, hours, city, logo_url, hero_image_url, primary_color, secondary_color, 
    published, hero_media_type, hero_video_url, flycontrol_enabled, flycontrol_api_url, 
    whatsapp_enabled, flycontrol_base_url, flycontrol_tenant_id, flycontrol_register_url, 
    show_item_images, owner_id, custom_subdomain, selected_template, business_type, 
    theme_settings, site_settings, checkout_settings, delivery_settings, seo_settings,
    order_flow_mode, fiqon_webhook_url, continue_opening_whatsapp, allow_dual_send,
    flycontrol_direct_url, menu_sync_endpoint
FROM public.restaurants;

-- Garante que as permissões continuem corretas
GRANT SELECT ON public.pizzerias_public TO anon, authenticated, service_role;
