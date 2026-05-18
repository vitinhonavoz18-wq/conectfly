-- Update the public view for pizzerias to include only safe fields
DROP VIEW IF EXISTS public.pizzerias_public;
CREATE OR REPLACE VIEW public.pizzerias_public AS
SELECT 
    id, 
    slug, 
    name, 
    tagline, 
    description, 
    whatsapp_number, 
    whatsapp_display, 
    address, 
    hours, 
    city, 
    logo_url, 
    hero_image_url, 
    primary_color, 
    secondary_color, 
    published
FROM public.restaurants;

-- Grant access to the view
GRANT SELECT ON public.pizzerias_public TO anon, authenticated;

-- Add policies to allow SELECT by FlyControl API Key for operational tables
-- We check if the restaurant_id/pizzeria_id matches a restaurant with the provided flycontrol_api_key in headers
-- Note: Supabase doesn't easily allow checking custom headers in RLS without extra setup, 
-- but we can use service_role or authenticated with proper checks.
-- For FlyControl (external system), it will likely use the anon/authenticated key + a header or just its own token.
-- Since the user asked to allow access by API Key, we'll implement policies that check the key if provided in a way the DB can see, 
-- or we rely on the authenticated role if FlyControl uses that.
-- However, the most robust way is to allow authenticated users who own the restaurant OR have the valid API Key.

-- Helper function to check FlyControl API Key (if we decide to pass it via GUC or similar)
-- For now, let's stick to standard RLS and ensure the owner/admin can always edit.

-- Ensure FlyControl can update data if it has a valid session or if we provide a specific mechanism.
-- The user mentioned "Allow FlyControl to consult by pizzeria_id, slug or API Key".

-- Enable RLS on all relevant tables (already enabled, but let's be sure)
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pizzeria_beverages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

-- Add UPDATE policies for authenticated users who own the restaurant
-- (This covers SiteCreatorFly admins/owners and FlyControl if it uses the same auth context)

CREATE POLICY "Owners can update menu_categories"
ON public.menu_categories
FOR UPDATE
TO authenticated
USING (owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Owners can update menu_items"
ON public.menu_items
FOR UPDATE
TO authenticated
USING (owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Owners can update combos"
ON public.combos
FOR UPDATE
TO authenticated
USING (owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Owners can update combo_groups"
ON public.combo_groups
FOR UPDATE
TO authenticated
USING (owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Owners can update beverages"
ON public.pizzeria_beverages
FOR UPDATE
TO authenticated
USING (owns_restaurant(auth.uid(), pizzeria_id));

CREATE POLICY "Owners can update delivery_zones"
ON public.delivery_zones
FOR UPDATE
TO authenticated
USING (owns_restaurant(auth.uid(), restaurant_id));

-- Add INSERT/DELETE policies as well to ensure full management
CREATE POLICY "Owners can insert menu_categories" ON public.menu_categories FOR INSERT TO authenticated WITH CHECK (owns_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Owners can delete menu_categories" ON public.menu_categories FOR DELETE TO authenticated USING (owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Owners can insert menu_items" ON public.menu_items FOR INSERT TO authenticated WITH CHECK (owns_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Owners can delete menu_items" ON public.menu_items FOR DELETE TO authenticated USING (owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Owners can insert combos" ON public.combos FOR INSERT TO authenticated WITH CHECK (owns_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Owners can delete combos" ON public.combos FOR DELETE TO authenticated USING (owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Owners can insert combo_groups" ON public.combo_groups FOR INSERT TO authenticated WITH CHECK (owns_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Owners can delete combo_groups" ON public.combo_groups FOR DELETE TO authenticated USING (owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Owners can insert beverages" ON public.pizzeria_beverages FOR INSERT TO authenticated WITH CHECK (owns_restaurant(auth.uid(), pizzeria_id));
CREATE POLICY "Owners can delete beverages" ON public.pizzeria_beverages FOR DELETE TO authenticated USING (owns_restaurant(auth.uid(), pizzeria_id));

CREATE POLICY "Owners can insert delivery_zones" ON public.delivery_zones FOR INSERT TO authenticated WITH CHECK (owns_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Owners can delete delivery_zones" ON public.delivery_zones FOR DELETE TO authenticated USING (owns_restaurant(auth.uid(), restaurant_id));
