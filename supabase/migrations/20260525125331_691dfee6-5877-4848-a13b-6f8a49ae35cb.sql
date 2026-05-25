-- 1. Habilitar RLS em todas as tabelas
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pizzeria_beverages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pizzeria_pizza_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flycontrol_order_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_logs ENABLE ROW LEVEL SECURITY;

-- 2. Limpar políticas antigas da tabela restaurants
DROP POLICY IF EXISTS "Public can view published restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Owners can manage their own restaurants" ON public.restaurants;

-- 3. Nova política para restaurants: Apenas o Admin Único pode ver tudo
CREATE POLICY "Admin manages all restaurants" 
ON public.restaurants 
FOR ALL 
TO authenticated 
USING (auth.uid() = 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3')
WITH CHECK (auth.uid() = 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3');

-- 4. Garantir que o público só veja dados via view pizzerias_public
-- (Supabase RLS não se aplica automaticamente a views se elas usarem SECURITY DEFINER ou se o SELECT for na view)
-- No entanto, como revogamos o SELECT da tabela base para anon, precisamos garantir que a view funcione.
-- Se a view foi criada por um admin (owner), ela funcionará. 

-- 5. Revogar SELECT direto na tabela restaurants para o público (anon)
REVOKE SELECT ON public.restaurants FROM anon;
-- Conceder SELECT na view segura
GRANT SELECT ON public.pizzerias_public TO anon, authenticated;

-- 6. Corrigir políticas de cardápio: Apenas Admin pode editar, Público só lê se restaurante for publicado
-- Menu Categories
DROP POLICY IF EXISTS "Admin All" ON public.menu_categories;
DROP POLICY IF EXISTS "Public Select" ON public.menu_categories;
CREATE POLICY "Admin manages categories" ON public.menu_categories FOR ALL TO authenticated USING (auth.uid() = 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3');
CREATE POLICY "Public views categories" ON public.menu_categories FOR SELECT TO anon, authenticated 
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.published = true));

-- Menu Items
DROP POLICY IF EXISTS "Admin All" ON public.menu_items;
DROP POLICY IF EXISTS "Public Select" ON public.menu_items;
CREATE POLICY "Admin manages items" ON public.menu_items FOR ALL TO authenticated USING (auth.uid() = 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3');
CREATE POLICY "Public views items" ON public.menu_items FOR SELECT TO anon, authenticated 
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.published = true));

-- Beverages
DROP POLICY IF EXISTS "Admin All" ON public.pizzeria_beverages;
DROP POLICY IF EXISTS "Public Select" ON public.pizzeria_beverages;
CREATE POLICY "Admin manages beverages" ON public.pizzeria_beverages FOR ALL TO authenticated USING (auth.uid() = 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3');
CREATE POLICY "Public views beverages" ON public.pizzeria_beverages FOR SELECT TO anon, authenticated 
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = pizzeria_id AND r.published = true));

-- Pizza Sizes
DROP POLICY IF EXISTS "Admin All" ON public.pizzeria_pizza_sizes;
DROP POLICY IF EXISTS "Public Select" ON public.pizzeria_pizza_sizes;
CREATE POLICY "Admin manages pizza sizes" ON public.pizzeria_pizza_sizes FOR ALL TO authenticated USING (auth.uid() = 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3');
CREATE POLICY "Public views pizza sizes" ON public.pizzeria_pizza_sizes FOR SELECT TO anon, authenticated 
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = pizzeria_id AND r.published = true));

-- Combos
DROP POLICY IF EXISTS "Admin All" ON public.combos;
DROP POLICY IF EXISTS "Public Select" ON public.combos;
CREATE POLICY "Admin manages combos" ON public.combos FOR ALL TO authenticated USING (auth.uid() = 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3');
CREATE POLICY "Public views combos" ON public.combos FOR SELECT TO anon, authenticated 
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.published = true));

-- Delivery Zones
DROP POLICY IF EXISTS "Admin All" ON public.delivery_zones;
DROP POLICY IF EXISTS "Public Select" ON public.delivery_zones;
CREATE POLICY "Admin manages delivery zones" ON public.delivery_zones FOR ALL TO authenticated USING (auth.uid() = 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3');
CREATE POLICY "Public views delivery zones" ON public.delivery_zones FOR SELECT TO anon, authenticated 
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.published = true));

-- 7. Corrigir is_admin para garantir search_path e segurança
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN (auth.uid() = 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3');
END;
$$;

-- 8. Corrigir check_order_rate_limit: restringe quem pode ver logs
CREATE OR REPLACE FUNCTION public.check_order_rate_limit(p_restaurant_id uuid, p_ip text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count
    FROM public.order_logs
    WHERE (ip_address = p_ip OR restaurant_id = p_restaurant_id)
      AND created_at > now() - interval '1 minute';
    
    IF v_count >= 10 THEN
        RETURN FALSE;
    END IF;
    
    INSERT INTO public.order_logs (ip_address, restaurant_id)
    VALUES (p_ip, p_restaurant_id);
    
    RETURN TRUE;
END;
$$;

-- 9. Corrigir get_restaurant_flycontrol_key
CREATE OR REPLACE FUNCTION public.get_restaurant_flycontrol_key(p_restaurant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $$
DECLARE
    v_key TEXT;
    v_owner_id UUID;
BEGIN
    SELECT owner_id, flycontrol_api_key INTO v_owner_id, v_key
    FROM public.restaurants
    WHERE id = p_restaurant_id;

    IF (auth.uid() = v_owner_id) OR (auth.uid() = 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3') THEN
        RETURN v_key;
    ELSE
        RETURN NULL;
    END IF;
END;
$$;

-- 10. Bloquear alteração de order_logs por qualquer um
DROP POLICY IF EXISTS "Admin Select" ON public.order_logs;
CREATE POLICY "Admin manages order logs" ON public.order_logs FOR ALL TO authenticated USING (auth.uid() = 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3');

DROP POLICY IF EXISTS "Admin Select" ON public.flycontrol_order_logs;
CREATE POLICY "Admin manages flycontrol logs" ON public.flycontrol_order_logs FOR ALL TO authenticated USING (auth.uid() = 'fb13f4ba-a3fe-45c4-917c-1ae6d09377a3');

-- Revogar permissão de execução pública de funções sensíveis se necessário
-- (Mas elas já estão protegidas por lógica interna ou por serem chamadas via backend admin)
