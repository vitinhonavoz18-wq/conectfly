-- Fix public menu access: anon policies must not call ownership helper functions.

-- menu_categories
DROP POLICY IF EXISTS "Public can view active menu_categories" ON public.menu_categories;
CREATE POLICY "Anon can view active menu_categories for published restaurants"
ON public.menu_categories
FOR SELECT
TO anon
USING (
  is_active IS TRUE
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = menu_categories.restaurant_id
      AND r.published IS TRUE
  )
);
CREATE POLICY "Authenticated can view menu_categories"
ON public.menu_categories
FOR SELECT
TO authenticated
USING (
  is_active IS TRUE
  OR owns_restaurant(auth.uid(), restaurant_id)
);

-- menu_items
DROP POLICY IF EXISTS "Public can view active menu_items" ON public.menu_items;
CREATE POLICY "Anon can view active menu_items for published restaurants"
ON public.menu_items
FOR SELECT
TO anon
USING (
  is_active IS TRUE
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = menu_items.restaurant_id
      AND r.published IS TRUE
  )
);
CREATE POLICY "Authenticated can view menu_items"
ON public.menu_items
FOR SELECT
TO authenticated
USING (
  is_active IS TRUE
  OR owns_restaurant(auth.uid(), restaurant_id)
);

-- combos
DROP POLICY IF EXISTS "Public can view active combos" ON public.combos;
CREATE POLICY "Anon can view active combos for published restaurants"
ON public.combos
FOR SELECT
TO anon
USING (
  is_active IS TRUE
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = combos.restaurant_id
      AND r.published IS TRUE
  )
);
CREATE POLICY "Authenticated can view combos"
ON public.combos
FOR SELECT
TO authenticated
USING (
  is_active IS TRUE
  OR owns_restaurant(auth.uid(), restaurant_id)
);

-- pizzeria_beverages
DROP POLICY IF EXISTS "Public can view active beverages" ON public.pizzeria_beverages;
CREATE POLICY "Anon can view active beverages for published restaurants"
ON public.pizzeria_beverages
FOR SELECT
TO anon
USING (
  is_active IS TRUE
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = pizzeria_beverages.pizzeria_id
      AND r.published IS TRUE
  )
);
CREATE POLICY "Authenticated can view beverages"
ON public.pizzeria_beverages
FOR SELECT
TO authenticated
USING (
  is_active IS TRUE
  OR owns_restaurant(auth.uid(), pizzeria_id)
);

-- combo_groups
DROP POLICY IF EXISTS "Public can view combo_groups" ON public.combo_groups;
CREATE POLICY "Anon can view combo_groups for published restaurants"
ON public.combo_groups
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = combo_groups.restaurant_id
      AND r.published IS TRUE
  )
);
CREATE POLICY "Authenticated can view combo_groups"
ON public.combo_groups
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = combo_groups.restaurant_id
      AND r.published IS TRUE
  )
  OR owns_restaurant(auth.uid(), restaurant_id)
);

-- delivery_zones
DROP POLICY IF EXISTS "Public can view delivery_zones" ON public.delivery_zones;
CREATE POLICY "Anon can view delivery_zones for published restaurants"
ON public.delivery_zones
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = delivery_zones.restaurant_id
      AND r.published IS TRUE
  )
);
CREATE POLICY "Authenticated can view delivery_zones"
ON public.delivery_zones
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = delivery_zones.restaurant_id
      AND r.published IS TRUE
  )
  OR owns_restaurant(auth.uid(), restaurant_id)
);