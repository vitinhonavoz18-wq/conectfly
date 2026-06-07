-- 1. Revoke public/anon access to sensitive columns
REVOKE SELECT (flycontrol_api_key) ON public.restaurants FROM anon, authenticated;
GRANT SELECT (flycontrol_api_key) ON public.restaurants TO service_role;

-- 2. Ensure RLS is enabled on all relevant tables
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pizzeria_beverages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pizzeria_pizza_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

-- 3. DROP old overly permissive policies if any (cleaning up)
DROP POLICY IF EXISTS "Public can read categories" ON public.menu_categories;
DROP POLICY IF EXISTS "Public can read items" ON public.menu_items;
DROP POLICY IF EXISTS "Public can read beverages" ON public.pizzeria_beverages;
DROP POLICY IF EXISTS "Public can read sizes" ON public.pizzeria_pizza_sizes;
DROP POLICY IF EXISTS "Public can read combos" ON public.combos;
DROP POLICY IF EXISTS "Public can read zones" ON public.delivery_zones;

-- 4. CREATE specific read policies for public access (Cardápio)
CREATE POLICY "Public read access for menu categories" ON public.menu_categories FOR SELECT USING (true);
CREATE POLICY "Public read access for menu items" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "Public read access for beverages" ON public.pizzeria_beverages FOR SELECT USING (true);
CREATE POLICY "Public read access for pizza sizes" ON public.pizzeria_pizza_sizes FOR SELECT USING (true);
CREATE POLICY "Public read access for combos" ON public.combos FOR SELECT USING (true);
CREATE POLICY "Public read access for delivery zones" ON public.delivery_zones FOR SELECT USING (true);
CREATE POLICY "Public read access for restaurants" ON public.restaurants FOR SELECT USING (true);

-- 5. Owner policies (Authenticated users can manage their own data)
-- Assuming auth.uid() = owner_id or using a helper function if needed.
-- Based on previous context, owners have owner_id column.
CREATE POLICY "Owners can manage their restaurants" ON public.restaurants
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can manage categories" ON public.menu_categories
  FOR ALL USING (EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND owner_id = auth.uid()));

CREATE POLICY "Owners can manage items" ON public.menu_items
  FOR ALL USING (EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND owner_id = auth.uid()));

CREATE POLICY "Owners can manage beverages" ON public.pizzeria_beverages
  FOR ALL USING (EXISTS (SELECT 1 FROM public.restaurants WHERE id = pizzeria_id AND owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants WHERE id = pizzeria_id AND owner_id = auth.uid()));

-- 6. Tables and QR Code Security
-- Tables should be readable by token or if you have the table_id.
-- Let's allow public read of tables but not editing.
DROP POLICY IF EXISTS "Public read tables" ON public.restaurant_tables;
CREATE POLICY "Public read tables" ON public.restaurant_tables FOR SELECT USING (true);

-- 7. Orders Security
-- Anon can INSERT orders but not read all orders.
DROP POLICY IF EXISTS "Public can submit orders" ON public.orders;
CREATE POLICY "Public can submit orders" ON public.orders FOR INSERT WITH CHECK (true);

-- Users can only read their own orders if authenticated or if they have some session (handled by API/Edge function usually)
-- For the dashboard, only owners can read orders of their restaurants
CREATE POLICY "Owners can read their restaurant orders" ON public.orders
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id AND owner_id = auth.uid()));

-- 8. GRANT permissions to service_role for Edge Functions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;
