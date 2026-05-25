-- 1. Helper to drop all policies for a table
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('restaurants', 'menu_categories', 'menu_items', 'pizzeria_pizza_sizes', 'pizzeria_beverages', 'combos', 'combo_groups', 'delivery_zones', 'flycontrol_order_logs', 'order_logs')) 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- 2. Single Admin Helper
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.uid() = 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Unified Policies

-- RESTAURANTS
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin All" ON public.restaurants FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Public Select" ON public.restaurants FOR SELECT TO anon, authenticated USING (published = true);

-- MENU CATEGORIES
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin All" ON public.menu_categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Public Select" ON public.menu_categories FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = restaurant_id AND r.published = true));

-- MENU ITEMS
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin All" ON public.menu_items FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Public Select" ON public.menu_items FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = restaurant_id AND r.published = true));

-- PIZZA SIZES
ALTER TABLE public.pizzeria_pizza_sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin All" ON public.pizzeria_pizza_sizes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Public Select" ON public.pizzeria_pizza_sizes FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = pizzeria_id AND r.published = true));

-- BEVERAGES
ALTER TABLE public.pizzeria_beverages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin All" ON public.pizzeria_beverages FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Public Select" ON public.pizzeria_beverages FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = pizzeria_id AND r.published = true));

-- COMBOS
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin All" ON public.combos FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Public Select" ON public.combos FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = restaurant_id AND r.published = true));

-- COMBO GROUPS
ALTER TABLE public.combo_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin All" ON public.combo_groups FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Public Select" ON public.combo_groups FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = restaurant_id AND r.published = true));

-- DELIVERY ZONES
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin All" ON public.delivery_zones FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Public Select" ON public.delivery_zones FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = restaurant_id AND r.published = true));

-- ORDER LOGS
ALTER TABLE public.flycontrol_order_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin Select" ON public.flycontrol_order_logs FOR SELECT TO authenticated USING (public.is_admin());
ALTER TABLE public.order_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin Select" ON public.order_logs FOR SELECT TO authenticated USING (public.is_admin());
