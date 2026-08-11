-- A view pizzerias_public (usada pelo site público, sem login) nunca filtrou
-- por "published" — ela devolvia a loja de qualquer jeito, publicada ou não.
-- É como uma placa de "fechado" pendurada na porta que não trava a fechadura:
-- continua dando para entrar. Isso também significa que "descadastrar" uma
-- loja pelo FlyControl não tirava o cardápio do ar, só escondia o painel.
CREATE OR REPLACE VIEW public.pizzerias_public AS
 SELECT id,
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
    published,
    hero_media_type,
    hero_video_url,
    flycontrol_enabled,
    flycontrol_api_url,
    whatsapp_enabled,
    flycontrol_base_url,
    flycontrol_tenant_id,
    flycontrol_register_url,
    show_item_images,
    owner_id,
    custom_subdomain,
    selected_template,
    business_type,
    theme_settings,
    site_settings,
    checkout_settings,
    delivery_settings,
    seo_settings,
    order_flow_mode,
    fiqon_webhook_url,
    continue_opening_whatsapp,
    allow_dual_send,
    flycontrol_direct_url,
    menu_sync_endpoint,
    delivery_enabled,
    pickup_enabled,
    table_enabled
   FROM restaurants
   WHERE published = true;

GRANT SELECT ON public.pizzerias_public TO anon, authenticated;
GRANT ALL ON public.pizzerias_public TO service_role;
