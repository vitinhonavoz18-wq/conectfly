-- Tabela de taxas de entrega por bairro
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  neighborhood TEXT NOT NULL,
  fee NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_zones_restaurant_idx
  ON public.delivery_zones (restaurant_id);

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public all" ON public.delivery_zones;
CREATE POLICY "public all" ON public.delivery_zones
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Normaliza sabores de pizza dos projetos existentes
UPDATE public.menu_items mi
SET price = 0
FROM public.menu_categories mc
WHERE mi.category_id = mc.id
  AND mc.is_pizza = true
  AND mi.price <> 0;

UPDATE public.menu_items mi
SET special_extra = 5
FROM public.menu_categories mc
WHERE mi.category_id = mc.id
  AND mc.is_pizza = true
  AND mi.is_special = true
  AND mi.special_extra <> 5;