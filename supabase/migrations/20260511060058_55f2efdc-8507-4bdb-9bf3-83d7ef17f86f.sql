-- 1. Roles infrastructure
CREATE TYPE public.app_role AS ENUM ('admin', 'owner');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "users view own roles" ON public.user_roles
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. owner_id on restaurants
ALTER TABLE public.restaurants 
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON public.restaurants(owner_id);

CREATE OR REPLACE FUNCTION public.owns_restaurant(_user_id uuid, _restaurant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants 
    WHERE id = _restaurant_id 
      AND (
        owner_id = _user_id 
        OR public.has_role(_user_id, 'admin')
        OR (owner_id IS NULL AND public.has_role(_user_id, 'admin'))
      )
  )
$$;

-- 3. Drop permissive policies
DROP POLICY IF EXISTS "public all" ON public.restaurants;
DROP POLICY IF EXISTS "public all" ON public.menu_categories;
DROP POLICY IF EXISTS "public all" ON public.menu_items;
DROP POLICY IF EXISTS "public all" ON public.combos;
DROP POLICY IF EXISTS "public all" ON public.combo_groups;
DROP POLICY IF EXISTS "public all" ON public.delivery_zones;

-- 4. Restaurants policies
CREATE POLICY "public read restaurants" ON public.restaurants
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "owner insert restaurants" ON public.restaurants
  FOR INSERT TO authenticated 
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner update restaurants" ON public.restaurants
  FOR UPDATE TO authenticated 
  USING (
    owner_id = auth.uid() 
    OR public.has_role(auth.uid(), 'admin')
    OR owner_id IS NULL
  )
  WITH CHECK (
    owner_id = auth.uid() 
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "owner delete restaurants" ON public.restaurants
  FOR DELETE TO authenticated 
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Hide sensitive columns from anon role
REVOKE SELECT (
  flycontrol_api_key, 
  flycontrol_api_url, 
  flycontrol_base_url, 
  flycontrol_register_url, 
  flycontrol_tenant_id
) ON public.restaurants FROM anon;

-- 5. Child tables: public read, owner write
CREATE POLICY "public read menu_categories" ON public.menu_categories 
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "owner write menu_categories" ON public.menu_categories 
  FOR ALL TO authenticated 
  USING (public.owns_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "public read menu_items" ON public.menu_items 
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "owner write menu_items" ON public.menu_items 
  FOR ALL TO authenticated 
  USING (public.owns_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "public read combos" ON public.combos 
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "owner write combos" ON public.combos 
  FOR ALL TO authenticated 
  USING (public.owns_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "public read combo_groups" ON public.combo_groups 
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "owner write combo_groups" ON public.combo_groups 
  FOR ALL TO authenticated 
  USING (public.owns_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "public read delivery_zones" ON public.delivery_zones 
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "owner write delivery_zones" ON public.delivery_zones 
  FOR ALL TO authenticated 
  USING (public.owns_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));

-- 6. pizzeria_beverages: scope to pizzeria owner
DROP POLICY IF EXISTS beverages_delete_policy ON public.pizzeria_beverages;
DROP POLICY IF EXISTS beverages_insert_policy ON public.pizzeria_beverages;
DROP POLICY IF EXISTS beverages_select_policy ON public.pizzeria_beverages;
DROP POLICY IF EXISTS beverages_update_policy ON public.pizzeria_beverages;

CREATE POLICY "public read active beverages" ON public.pizzeria_beverages
  FOR SELECT TO anon, authenticated 
  USING (is_active = true OR public.owns_restaurant(auth.uid(), pizzeria_id));

CREATE POLICY "owner insert beverages" ON public.pizzeria_beverages
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_restaurant(auth.uid(), pizzeria_id));

CREATE POLICY "owner update beverages" ON public.pizzeria_beverages
  FOR UPDATE TO authenticated
  USING (public.owns_restaurant(auth.uid(), pizzeria_id))
  WITH CHECK (public.owns_restaurant(auth.uid(), pizzeria_id));

CREATE POLICY "owner delete beverages" ON public.pizzeria_beverages
  FOR DELETE TO authenticated
  USING (public.owns_restaurant(auth.uid(), pizzeria_id));

-- 7. Storage: logos bucket - lock down writes
DROP POLICY IF EXISTS "logos public write" ON storage.objects;
DROP POLICY IF EXISTS "logos public update" ON storage.objects;
DROP POLICY IF EXISTS "logos public delete" ON storage.objects;

CREATE POLICY "logos auth insert" ON storage.objects 
  FOR INSERT TO authenticated 
  WITH CHECK (bucket_id = 'logos');
CREATE POLICY "logos auth update" ON storage.objects 
  FOR UPDATE TO authenticated 
  USING (bucket_id = 'logos');
CREATE POLICY "logos auth delete" ON storage.objects 
  FOR DELETE TO authenticated 
  USING (bucket_id = 'logos');

-- 8. Fix function search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql 
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;