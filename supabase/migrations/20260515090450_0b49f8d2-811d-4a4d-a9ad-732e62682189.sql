-- 1. Ensure RLS on standard tables using restaurant context
DO $$ 
DECLARE 
    t TEXT;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name IN ('menu_categories', 'menu_items', 'combos', 'combo_groups', 'delivery_zones', 'pizzeria_beverages', 'flavors', 'fillings', 'flavor_categories')
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        
        -- Public read access
        EXECUTE format('DROP POLICY IF EXISTS "Public can view %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Public can view %I" ON public.%I FOR SELECT USING (true)', t, t);
        
        -- Owner full access (checking via owns_restaurant function)
        EXECUTE format('DROP POLICY IF EXISTS "Owners can manage %I" ON public.%I', t, t);
        -- Note: We handle the column name variation (restaurant_id vs pizzeria_id)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'restaurant_id') THEN
            EXECUTE format('CREATE POLICY "Owners can manage %I" ON public.%I FOR ALL TO authenticated USING (public.owns_restaurant(auth.uid(), restaurant_id))', t, t);
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'pizzeria_id') THEN
            EXECUTE format('CREATE POLICY "Owners can manage %I" ON public.%I FOR ALL TO authenticated USING (public.owns_restaurant(auth.uid(), pizzeria_id))', t, t);
        END IF;
    END LOOP;
END $$;

-- 2. Final check on order_logs (used for rate limiting)
-- No one but service_role should access it
ALTER TABLE public.order_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only" ON public.order_logs;
-- By not adding any policy, even authenticated users can't see it (except via SECURITY DEFINER functions)
