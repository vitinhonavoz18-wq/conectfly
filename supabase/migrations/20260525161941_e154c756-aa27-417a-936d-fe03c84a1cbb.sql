-- 1. Política para permitir leitura pública na tabela restaurants
-- Isso é necessário para que a view pizzerias_public (que consulta esta tabela) 
-- retorne resultados para usuários anônimos, mesmo com RLS ativado.
CREATE POLICY "Public can view published restaurants" 
ON public.restaurants 
FOR SELECT 
USING (published = true);

-- 2. Garantir permissões de SELECT para usuários anônimos e autenticados nas tabelas e views necessárias
GRANT SELECT ON public.restaurants TO anon, authenticated;
GRANT SELECT ON public.pizzerias_public TO anon, authenticated;

-- 3. Confirmar se as tabelas de suporte também possuem permissões adequadas
GRANT SELECT ON public.menu_categories TO anon, authenticated;
GRANT SELECT ON public.menu_items TO anon, authenticated;
GRANT SELECT ON public.combo_groups TO anon, authenticated;
GRANT SELECT ON public.combos TO anon, authenticated;
GRANT SELECT ON public.delivery_zones TO anon, authenticated;
GRANT SELECT ON public.pizzeria_beverages TO anon, authenticated;
GRANT SELECT ON public.pizzeria_pizza_sizes TO anon, authenticated;

-- 4. Ajustar a view pizzerias_public para garantir que ela use todos os campos necessários
-- e seja definida como SECURITY INVOKER para respeitar a política de restaurants.
-- Nota: Supabase views são por padrão SECURITY INVOKER se não especificado.
CREATE OR REPLACE VIEW public.pizzerias_public AS
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
