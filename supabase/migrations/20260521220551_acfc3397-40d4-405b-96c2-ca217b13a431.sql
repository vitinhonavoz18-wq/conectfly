-- Fix Public can view beverages of published pizzerias
DROP POLICY IF EXISTS "Public can view beverages of published pizzerias" ON public.pizzeria_beverages;
CREATE POLICY "Public can view beverages of published pizzerias" 
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

-- Fix Public can view pizza sizes of published pizzerias
DROP POLICY IF EXISTS "Public can view pizza sizes of published pizzerias" ON public.pizzeria_pizza_sizes;
CREATE POLICY "Public can view pizza sizes of published pizzerias" 
ON public.pizzeria_pizza_sizes 
FOR SELECT 
TO anon, authenticated
USING (
  is_active = true AND 
  EXISTS (
    SELECT 1 FROM public.restaurants r 
    WHERE r.id = pizzeria_pizza_sizes.pizzeria_id AND r.published = true
  )
);
