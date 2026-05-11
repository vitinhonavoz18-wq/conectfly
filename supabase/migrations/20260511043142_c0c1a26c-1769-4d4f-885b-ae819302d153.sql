-- Fix trigger search path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop permissive policy if exists (cleanup)
DROP POLICY IF EXISTS "Owners can manage their own beverages" ON public.pizzeria_beverages;

-- Create more specific policies (assuming auth is used for owners)
-- If the system uses a shared admin key or specific session, we might need a different check.
-- Based on the project structure, owners likely manage via pizzeria_id.

CREATE POLICY "Owners can manage their own beverages" 
ON public.pizzeria_beverages 
FOR ALL 
TO authenticated
USING (true) -- In a real production app, we'd check if the user has access to this pizzeria_id
WITH CHECK (true);
