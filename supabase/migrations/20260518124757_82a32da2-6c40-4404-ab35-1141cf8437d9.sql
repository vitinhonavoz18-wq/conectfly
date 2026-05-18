-- Add active status and highlight columns
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.combos ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.combos ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT false;

-- Update RLS policies for menu_categories to only show active ones to public
DROP POLICY IF EXISTS "Public can view menu_categories" ON public.menu_categories;
CREATE POLICY "Public can view menu_categories" ON public.menu_categories
  FOR SELECT USING (is_active = true OR owns_restaurant(auth.uid(), restaurant_id));

-- Update RLS policies for menu_items to only show active ones to public
DROP POLICY IF EXISTS "Public can view menu_items" ON public.menu_items;
CREATE POLICY "Public can view menu_items" ON public.menu_items
  FOR SELECT USING (is_active = true OR owns_restaurant(auth.uid(), restaurant_id));

-- Update RLS policies for combos to only show active ones to public
DROP POLICY IF EXISTS "Public can view combos" ON public.combos;
CREATE POLICY "Public can view combos" ON public.combos
  FOR SELECT USING (is_active = true OR owns_restaurant(auth.uid(), restaurant_id));
