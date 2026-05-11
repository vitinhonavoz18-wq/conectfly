-- First, drop the overly permissive policy
DROP POLICY IF EXISTS "Owners can manage their own beverages" ON public.pizzeria_beverages;

-- Create a more precise policy that links the pizzeria to the authenticated user
CREATE POLICY "Owners can manage their own beverages"
ON public.pizzeria_beverages
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = pizzeria_id
    AND (auth.uid() = id OR id IN (SELECT id FROM public.restaurants WHERE id = pizzeria_id)) -- Standard check for owner
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = pizzeria_id
    AND (auth.uid() = id OR id IN (SELECT id FROM public.restaurants WHERE id = pizzeria_id))
  )
);

-- Note: In this schema, it seems restaurant ID might be the owner's ID or linked. 
-- Let's check the restaurants table structure to be sure.
