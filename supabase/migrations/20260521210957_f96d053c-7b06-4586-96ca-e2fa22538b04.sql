-- 1. Fix pizzeria_pizza_sizes policies
DROP POLICY IF EXISTS "Admins can manage their pizza sizes" ON public.pizzeria_pizza_sizes;
DROP POLICY IF EXISTS "Pizza sizes are viewable by everyone" ON public.pizzeria_pizza_sizes;

CREATE POLICY "Public can view pizza sizes of published pizzerias"
ON public.pizzeria_pizza_sizes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = pizzeria_pizza_sizes.pizzeria_id
      AND r.published = true
  )
);

CREATE POLICY "Owners and admins can manage pizza sizes"
ON public.pizzeria_pizza_sizes
FOR ALL
TO authenticated
USING (public.owns_restaurant(auth.uid(), pizzeria_id))
WITH CHECK (public.owns_restaurant(auth.uid(), pizzeria_id));


-- 2. Consolidate pizzeria_beverages policies
DROP POLICY IF EXISTS "owner insert beverages" ON public.pizzeria_beverages;
DROP POLICY IF EXISTS "owner update beverages" ON public.pizzeria_beverages;
DROP POLICY IF EXISTS "owner delete beverages" ON public.pizzeria_beverages;
DROP POLICY IF EXISTS "Owners can manage pizzeria_beverages" ON public.pizzeria_beverages;
DROP POLICY IF EXISTS "Owners can insert beverages" ON public.pizzeria_beverages;
DROP POLICY IF EXISTS "Owners can delete beverages" ON public.pizzeria_beverages;
DROP POLICY IF EXISTS "Owners can update beverages" ON public.pizzeria_beverages;
DROP POLICY IF EXISTS "Authenticated can view beverages" ON public.pizzeria_beverages;
DROP POLICY IF EXISTS "Anon can view active beverages for published restaurants" ON public.pizzeria_beverages;

CREATE POLICY "Public can view beverages of published pizzerias"
ON public.pizzeria_beverages
FOR SELECT
USING (
  is_active = true AND
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = pizzeria_beverages.pizzeria_id
      AND r.published = true
  )
);

CREATE POLICY "Owners and admins can manage beverages"
ON public.pizzeria_beverages
FOR ALL
TO authenticated
USING (public.owns_restaurant(auth.uid(), pizzeria_id))
WITH CHECK (public.owns_restaurant(auth.uid(), pizzeria_id));


-- 3. Restrict sensitive column access on restaurants table for anon
-- We use column-level grants to hide the API key
REVOKE ALL ON public.restaurants FROM anon;
REVOKE ALL ON public.restaurants FROM authenticated;

-- Grant access to non-sensitive columns for everyone
GRANT SELECT (
  id, slug, name, tagline, description, whatsapp_number, whatsapp_display, 
  whatsapp_enabled, address, hours, city, logo_url, hero_image_url, 
  hero_media_type, hero_video_url, primary_color, secondary_color, 
  published, show_item_images, flycontrol_enabled, flycontrol_base_url, 
  flycontrol_api_url, owner_id, created_at, updated_at
) ON public.restaurants TO anon, authenticated;

-- Grant full access to authenticated for other operations (protected by RLS)
GRANT INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
-- Grant full access to service_role (always needed for admin operations)
GRANT ALL ON public.restaurants TO service_role;
-- Grant select on all columns (including secret ones) to authenticated for their own rows
-- Note: PostgreSQL column grants are not easily combined with RLS for "own row" visibility of specific columns.
-- However, since the frontend uses pizzerias_public, and the admin panel uses restaurants, 
-- we need the owner to see their own key.
GRANT SELECT (flycontrol_api_key, flycontrol_tenant_id, flycontrol_register_url) ON public.restaurants TO authenticated;

-- Ensure RLS is still enabled
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pizzeria_pizza_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pizzeria_beverages ENABLE ROW LEVEL SECURITY;
