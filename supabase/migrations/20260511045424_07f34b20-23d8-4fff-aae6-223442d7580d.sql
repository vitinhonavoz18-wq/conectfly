-- Temporarily relax the policy to allow authenticated users to insert/update beverages
DROP POLICY IF EXISTS "Owners can manage their own beverages" ON public.pizzeria_beverages;

CREATE POLICY "Authenticated users can manage beverages"
ON public.pizzeria_beverages
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
