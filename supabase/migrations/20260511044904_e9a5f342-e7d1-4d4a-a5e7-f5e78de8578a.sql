-- Ensure the policy exists and is correct for public access
DROP POLICY IF EXISTS "Public can view active beverages" ON public.pizzeria_beverages;

CREATE POLICY "Public can view active beverages" 
ON public.pizzeria_beverages 
FOR SELECT 
USING (is_active = true);
