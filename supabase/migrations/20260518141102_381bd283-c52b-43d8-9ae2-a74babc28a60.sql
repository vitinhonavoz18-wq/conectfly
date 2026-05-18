-- Garantir que a view pizzerias_public seja acessível
GRANT SELECT ON public.pizzerias_public TO anon, authenticated;

-- Atualizar políticas da tabela restaurants para leitura pública
DROP POLICY IF EXISTS "Public can view published restaurants" ON public.restaurants;
CREATE POLICY "Public can view published restaurants"
ON public.restaurants
FOR SELECT
TO anon, authenticated
USING (published = true);

-- Atualizar políticas para menu_categories
DROP POLICY IF EXISTS "Anon can view active menu_categories for published restaurants" ON public.menu_categories;
CREATE POLICY "Anon can view active menu_categories for published restaurants"
ON public.menu_categories
FOR SELECT
TO anon, authenticated
USING (
  is_active = true AND 
  EXISTS (
    SELECT 1 FROM public.restaurants r 
    WHERE r.id = menu_categories.restaurant_id AND r.published = true
  )
);

-- Atualizar políticas para menu_items
DROP POLICY IF EXISTS "Anon can view active menu_items for published restaurants" ON public.menu_items;
CREATE POLICY "Anon can view active menu_items for published restaurants"
ON public.menu_items
FOR SELECT
TO anon, authenticated
USING (
  is_active = true AND 
  EXISTS (
    SELECT 1 FROM public.restaurants r 
    WHERE r.id = menu_items.restaurant_id AND r.published = true
  )
);

-- Atualizar políticas para combos
DROP POLICY IF EXISTS "Anon can view active combos for published restaurants" ON public.combos;
CREATE POLICY "Anon can view active combos for published restaurants"
ON public.combos
FOR SELECT
TO anon, authenticated
USING (
  is_active = true AND 
  EXISTS (
    SELECT 1 FROM public.restaurants r 
    WHERE r.id = combos.restaurant_id AND r.published = true
  )
);

-- Atualizar políticas para combo_groups
DROP POLICY IF EXISTS "Anon can view combo_groups for published restaurants" ON public.combo_groups;
CREATE POLICY "Anon can view combo_groups for published restaurants"
ON public.combo_groups
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r 
    WHERE r.id = combo_groups.restaurant_id AND r.published = true
  )
);

-- Atualizar políticas para pizzeria_beverages
DROP POLICY IF EXISTS "Anon can view active beverages for published restaurants" ON public.pizzeria_beverages;
CREATE POLICY "Anon can view active beverages for published restaurants"
ON public.pizzeria_beverages
FOR SELECT
TO anon, authenticated
USING (
  is_active = true AND 
  EXISTS (
    SELECT 1 FROM public.restaurants r 
    WHERE r.id = pizzeria_beverages.pizzeria_id AND r.published = true
  )
);

-- Atualizar políticas para delivery_zones
DROP POLICY IF EXISTS "Anon can view delivery_zones for published restaurants" ON public.delivery_zones;
CREATE POLICY "Anon can view delivery_zones for published restaurants"
ON public.delivery_zones
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r 
    WHERE r.id = delivery_zones.restaurant_id AND r.published = true
  )
);
