-- 1. Allow public access to published restaurants
CREATE POLICY "Public can view published restaurants"
ON public.restaurants
FOR SELECT
USING (published = true);

-- 2. Update existing policies for menu_categories to be truly public for active items
DROP POLICY IF EXISTS "public read menu_categories" ON public.menu_categories;
DROP POLICY IF EXISTS "Public can view menu_categories" ON public.menu_categories;
CREATE POLICY "Public can view active menu_categories"
ON public.menu_categories
FOR SELECT
USING (is_active = true OR (auth.role() = 'authenticated' AND owns_restaurant(auth.uid(), restaurant_id)));

-- 3. Update existing policies for menu_items
DROP POLICY IF EXISTS "public read menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Public can view menu_items" ON public.menu_items;
CREATE POLICY "Public can view active menu_items"
ON public.menu_items
FOR SELECT
USING (is_active = true OR (auth.role() = 'authenticated' AND owns_restaurant(auth.uid(), restaurant_id)));

-- 4. Update existing policies for combos
DROP POLICY IF EXISTS "public read combos" ON public.combos;
DROP POLICY IF EXISTS "Public can view combos" ON public.combos;
CREATE POLICY "Public can view active combos"
ON public.combos
FOR SELECT
USING (is_active = true OR (auth.role() = 'authenticated' AND owns_restaurant(auth.uid(), restaurant_id)));

-- 5. Update existing policies for combo_groups
DROP POLICY IF EXISTS "public read combo_groups" ON public.combo_groups;
DROP POLICY IF EXISTS "Public can view combo_groups" ON public.combo_groups;
CREATE POLICY "Public can view combo_groups"
ON public.combo_groups
FOR SELECT
USING (true);

-- 6. Update existing policies for pizzeria_beverages
DROP POLICY IF EXISTS "public read active beverages" ON public.pizzeria_beverages;
DROP POLICY IF EXISTS "Public can view pizzeria_beverages" ON public.pizzeria_beverages;
CREATE POLICY "Public can view active beverages"
ON public.pizzeria_beverages
FOR SELECT
USING (is_active = true OR (auth.role() = 'authenticated' AND owns_restaurant(auth.uid(), pizzeria_id)));

-- 7. Ensure delivery_zones are public
DROP POLICY IF EXISTS "public read delivery_zones" ON public.delivery_zones;
DROP POLICY IF EXISTS "Public can view delivery_zones" ON public.delivery_zones;
CREATE POLICY "Public can view delivery_zones"
ON public.delivery_zones
FOR SELECT
USING (true);
