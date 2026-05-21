-- Ensure RLS is enabled on all tables
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pizzeria_beverages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pizzeria_pizza_sizes ENABLE ROW LEVEL SECURITY;

-- 1. Create a secure view for public consumption (overwriting if exists to ensure security)
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
    flycontrol_api_url
FROM public.restaurants
WHERE published = true;

-- 2. PUBLIC SELECT POLICIES (Anonymous access)
-- Note: We use 'true' for check since the WHERE clause in view or restaurant query filters published ones

-- Restaurants: Allow anyone to see published restaurants
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view published restaurants') THEN
        CREATE POLICY "Public can view published restaurants" ON public.restaurants
        FOR SELECT USING (published = true);
    END IF;
END $$;

-- Menu Categories: Allow anyone to see categories of published restaurants
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view categories of published restaurants') THEN
        CREATE POLICY "Public can view categories of published restaurants" ON public.menu_categories
        FOR SELECT USING (EXISTS (
            SELECT 1 FROM public.restaurants 
            WHERE restaurants.id = menu_categories.restaurant_id AND restaurants.published = true
        ));
    END IF;
END $$;

-- Menu Items: Allow anyone to see items of published restaurants
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view items of published restaurants') THEN
        CREATE POLICY "Public can view items of published restaurants" ON public.menu_items
        FOR SELECT USING (EXISTS (
            SELECT 1 FROM public.restaurants 
            WHERE restaurants.id = menu_items.restaurant_id AND restaurants.published = true
        ));
    END IF;
END $$;

-- Pizza Sizes: Allow anyone to see sizes of published restaurants
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view sizes of published restaurants') THEN
        CREATE POLICY "Public can view sizes of published restaurants" ON public.pizzeria_pizza_sizes
        FOR SELECT USING (EXISTS (
            SELECT 1 FROM public.restaurants 
            WHERE restaurants.id = pizzeria_pizza_sizes.pizzeria_id AND restaurants.published = true
        ));
    END IF;
END $$;

-- Beverages: Allow anyone to see beverages of published restaurants
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view beverages of published restaurants') THEN
        CREATE POLICY "Public can view beverages of published restaurants" ON public.pizzeria_beverages
        FOR SELECT USING (EXISTS (
            SELECT 1 FROM public.restaurants 
            WHERE restaurants.id = pizzeria_beverages.pizzeria_id AND restaurants.published = true
        ));
    END IF;
END $$;

-- Delivery Zones: Allow anyone to see zones of published restaurants
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view zones of published restaurants') THEN
        CREATE POLICY "Public can view zones of published restaurants" ON public.delivery_zones
        FOR SELECT USING (EXISTS (
            SELECT 1 FROM public.restaurants 
            WHERE restaurants.id = delivery_zones.restaurant_id AND restaurants.published = true
        ));
    END IF;
END $$;

-- Combos and Groups
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view combo groups of published restaurants') THEN
        CREATE POLICY "Public can view combo groups of published restaurants" ON public.combo_groups
        FOR SELECT USING (EXISTS (
            SELECT 1 FROM public.restaurants 
            WHERE restaurants.id = combo_groups.restaurant_id AND restaurants.published = true
        ));
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view combos of published restaurants') THEN
        CREATE POLICY "Public can view combos of published restaurants" ON public.combos
        FOR SELECT USING (EXISTS (
            SELECT 1 FROM public.restaurants 
            WHERE restaurants.id = combos.restaurant_id AND restaurants.published = true
        ));
    END IF;
END $$;

-- 3. ENSURE NO ANONYMOUS WRITE ACCESS (Redundant but safe)
-- Most tables should already have OWNER policies, but let's make sure anon role is not in them.
-- Policies using (auth.uid() = owner_id) or owns_restaurant(...) already block anonymous (uid is null).

-- 4. FIX SENSITIVE DATA EXPOSURE
-- Ensure 'pizzerias_public' is what we use in frontend
GRANT SELECT ON public.pizzerias_public TO anon, authenticated;
GRANT SELECT ON public.restaurants TO anon, authenticated;
GRANT SELECT ON public.menu_categories TO anon, authenticated;
GRANT SELECT ON public.menu_items TO anon, authenticated;
GRANT SELECT ON public.pizzeria_pizza_sizes TO anon, authenticated;
GRANT SELECT ON public.pizzeria_beverages TO anon, authenticated;
GRANT SELECT ON public.delivery_zones TO anon, authenticated;
GRANT SELECT ON public.combo_groups TO anon, authenticated;
GRANT SELECT ON public.combos TO anon, authenticated;
