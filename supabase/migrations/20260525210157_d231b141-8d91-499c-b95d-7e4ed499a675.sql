-- Add missing columns to pizzeria_beverages
ALTER TABLE public.pizzeria_beverages 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS category TEXT;

-- Standardize names if needed, but the user requested "subtipo/categoria" which maps well to 'category'.

-- Enable RLS if not enabled
ALTER TABLE public.pizzeria_beverages ENABLE ROW LEVEL SECURITY;

-- Ensure public access for viewing
DROP POLICY IF EXISTS "Pizzeria beverages are viewable by everyone" ON public.pizzeria_beverages;
CREATE POLICY "Pizzeria beverages are viewable by everyone" 
ON public.pizzeria_beverages 
FOR SELECT 
USING (true);

-- Ensure owners can manage their beverages
DROP POLICY IF EXISTS "Owners can manage their own beverages" ON public.pizzeria_beverages;
CREATE POLICY "Owners can manage their own beverages" 
ON public.pizzeria_beverages 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.restaurants r 
  WHERE r.id = pizzeria_beverages.pizzeria_id 
  AND r.owner_id = auth.uid()
));